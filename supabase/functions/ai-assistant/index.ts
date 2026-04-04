import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service role client for DB queries
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, data, userType, message, context, history } = await req.json();

    // Validate admin actions
    const adminActions = ["analyze-report", "verify-receipt", "check-seller"];
    if (adminActions.includes(action)) {
      const { data: roleCheck } = await supabaseAuth.rpc('has_role', { _user_id: userId, _role: 'admin' });
      if (!roleCheck) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ========== FETCH REAL DATABASE STATS ==========
    let dbContext = "";

    try {
      if (userType === "acheteur") {
        // Buyer: wallet, orders, available products
        const [walletRes, ordersRes, productsRes, shopsRes] = await Promise.all([
          supabaseAdmin.from("wallets").select("balance_dop, balance_htg, balance_usd").eq("user_id", userId).single(),
          supabaseAdmin.from("orders").select("id, status, total_amount, currency, created_at").eq("buyer_id", userId).order("created_at", { ascending: false }).limit(10),
          supabaseAdmin.from("products").select("id").eq("is_active", true),
          supabaseAdmin.from("seller_applications").select("id").eq("status", "approved"),
        ]);

        const w = walletRes.data;
        const orders = ordersRes.data || [];
        const pendingOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status || ""));
        
        dbContext = `
DONNÉES RÉELLES DE L'UTILISATEUR:
- Solde portefeuille: ${w?.balance_dop || 0} DOP, ${w?.balance_htg || 0} HTG, ${w?.balance_usd || 0} USD
- Commandes totales: ${orders.length}
- Commandes en cours: ${pendingOrders.length}
- Dernières commandes: ${orders.slice(0, 3).map(o => `#${o.id.slice(0,8)} (${o.status}, ${o.total_amount} ${o.currency})`).join(", ") || "Aucune"}
- Produits disponibles sur la plateforme: ${productsRes.data?.length || 0}
- Boutiques actives: ${shopsRes.data?.length || 0}`;

      } else if (userType === "vendeur") {
        // Seller: products, orders, revenue, wallet
        const [productsRes, itemsRes, walletRes, shopsRes] = await Promise.all([
          supabaseAdmin.from("products").select("id, name, is_active, price, stock_quantity").eq("seller_id", userId),
          supabaseAdmin.from("order_items").select("total_price, order_id, quantity, product_id").eq("seller_id", userId),
          supabaseAdmin.from("wallets").select("balance_dop, balance_htg, balance_usd").eq("user_id", userId).single(),
          supabaseAdmin.from("seller_applications").select("shop_name").eq("user_id", userId).eq("status", "approved").single(),
        ]);

        const products = productsRes.data || [];
        const items = itemsRes.data || [];
        const totalRevenue = items.reduce((s, i) => s + Number(i.total_price), 0);
        const orderIds = [...new Set(items.map(i => i.order_id))];
        const w = walletRes.data;

        // Get order statuses
        let pendingOrders = 0;
        if (orderIds.length > 0) {
          const { data: ords } = await supabaseAdmin.from("orders").select("id, status").in("id", orderIds);
          pendingOrders = ords?.filter(o => ["confirmed", "preparing", "ready"].includes(o.status || "")).length || 0;
        }

        const lowStock = products.filter(p => (p.stock_quantity || 0) <= 3 && p.is_active);

        dbContext = `
DONNÉES RÉELLES DU VENDEUR:
- Boutique: ${shopsRes.data?.shop_name || "Non définie"}
- Produits total: ${products.length} (${products.filter(p => p.is_active).length} actifs)
- Commandes totales: ${orderIds.length}
- Commandes à traiter: ${pendingOrders}
- Revenue total: ${totalRevenue} DOP
- Solde portefeuille: ${w?.balance_dop || 0} DOP, ${w?.balance_htg || 0} HTG, ${w?.balance_usd || 0} USD
- Produits en rupture/faible stock: ${lowStock.length > 0 ? lowStock.map(p => `${p.name} (${p.stock_quantity} restants)`).join(", ") : "Aucun"}
- Top produits: ${products.slice(0, 5).map(p => `${p.name} (${p.price} DOP)`).join(", ")}`;

      } else if (userType === "livreur") {
        // Driver: deliveries, earnings, wallet
        const [ordersRes, walletRes, driverRes] = await Promise.all([
          supabaseAdmin.from("orders").select("id, status, delivery_fee, currency, created_at, delivery_city").eq("driver_id", userId).order("created_at", { ascending: false }).limit(20),
          supabaseAdmin.from("wallets").select("balance_dop, balance_htg, balance_usd").eq("user_id", userId).single(),
          supabaseAdmin.from("driver_applications").select("vehicle_type, vehicle_brand, city, status").eq("user_id", userId).single(),
        ]);

        const orders = ordersRes.data || [];
        const delivered = orders.filter(o => o.status === "delivered");
        const inProgress = orders.filter(o => ["ready_for_pickup", "picked_up", "in_transit"].includes(o.status || ""));
        const totalEarnings = delivered.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
        const w = walletRes.data;

        // Available deliveries
        const { data: available } = await supabaseAdmin.from("orders").select("id").eq("status", "ready").is("driver_id", null);

        dbContext = `
DONNÉES RÉELLES DU LIVREUR:
- Véhicule: ${driverRes.data?.vehicle_type || "N/A"} ${driverRes.data?.vehicle_brand || ""}
- Ville: ${driverRes.data?.city || "N/A"}
- Livraisons complétées: ${delivered.length}
- Livraisons en cours: ${inProgress.length}
- Gains totaux: ${totalEarnings} DOP
- Solde portefeuille: ${w?.balance_dop || 0} DOP, ${w?.balance_htg || 0} HTG, ${w?.balance_usd || 0} USD
- Livraisons disponibles à prendre: ${available?.length || 0}`;

      } else if (userType === "admin") {
        // Admin: platform-wide stats
        const [usersRes, ordersRes, productsRes, ticketsRes, reportsRes, walletsRes, sellersRes, driversRes] = await Promise.all([
          supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("orders").select("id, status, total_amount, created_at"),
          supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabaseAdmin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabaseAdmin.from("wallets").select("balance_dop, balance_htg, balance_usd"),
          supabaseAdmin.from("seller_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
          supabaseAdmin.from("driver_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
        ]);

        const orders = ordersRes.data || [];
        const today = new Date().toISOString().split("T")[0];
        const todayOrders = orders.filter(o => o.created_at?.startsWith(today));
        const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
        const pendingOrders = orders.filter(o => ["pending", "confirmed"].includes(o.status || ""));
        const wallets = walletsRes.data || [];
        const totalDOP = wallets.reduce((s, w) => s + Number(w.balance_dop || 0), 0);

        dbContext = `
DONNÉES RÉELLES DE LA PLATEFORME:
- Utilisateurs inscrits: ${usersRes.count || 0}
- Vendeurs approuvés: ${sellersRes.count || 0}
- Livreurs approuvés: ${driversRes.count || 0}
- Produits actifs: ${productsRes.count || 0}
- Commandes totales: ${orders.length}
- Commandes aujourd'hui: ${todayOrders.length}
- Commandes en attente: ${pendingOrders.length}
- Revenue total plateforme: ${totalRevenue} DOP
- Tickets support ouverts: ${ticketsRes.count || 0}
- Signalements en attente: ${reportsRes.count || 0}
- Total en circulation (DOP): ${totalDOP}`;
      }
    } catch (dbErr) {
      console.error("DB context fetch error:", dbErr);
      dbContext = "\n(Impossible de récupérer les données en temps réel)";
    }

    let systemPrompt = "";
    let userPrompt = "";
    let temperature = 0.7;
    let useToolCalling = false;

    // ============ ADMIN ACTIONS ============
    if (action === "analyze-report") {
      systemPrompt = `Tu es un expert en modération de marketplace. Analyse les signalements et donne des recommandations objectives. Réponds TOUJOURS en français.${dbContext}`;
      userPrompt = `Analyse ce signalement :
Type: ${data.type}
Description: ${data.description}
Utilisateur signalé: Note ${data.userRating || "N/A"}/5, ${data.previousReports || 0} signalements précédents
Montant de la commande: ${data.orderAmount || "N/A"} RD$

Fournis une analyse structurée avec: niveau de risque, recommandation, raison, action suggérée, et confiance (0-100).`;
      temperature = 0.3;
      useToolCalling = true;
    } else if (action === "verify-receipt") {
      systemPrompt = `Tu es un expert en vérification de paiements. Analyse les reçus et détecte les anomalies.${dbContext}`;
      userPrompt = `Vérifie ce reçu :
Texte OCR: "${data.receiptText}"
Montant attendu: ${data.expectedAmount} RD$
ID transaction attendu: ${data.expectedTransactionId}

Fournis: montant trouvé, ID transaction trouvé, date trouvée, validité, anomalies et confiance.`;
      temperature = 0.2;
      useToolCalling = true;
    } else if (action === "check-seller") {
      systemPrompt = `Tu es un expert en détection de fraude pour marketplace.${dbContext}`;
      userPrompt = `Évalue ce vendeur :
- Inscrit depuis: ${data.joinDate || "inconnu"}
- Total ventes: ${data.totalSales || 0} RD$
- Nombre commandes: ${data.orderCount || 0}
- Note moyenne: ${data.rating || 0}/5
- Avis négatifs: ${data.negativeReviews || 0}
- Remboursements: ${data.refunds || 0}

Fournis: risque de fraude (0-100), score fiabilité, recommandation, drapeaux rouges et raison.`;
      temperature = 0.3;
      useToolCalling = true;

    // ============ CHAT ASSISTANTS ============
    } else if (userType === "acheteur") {
      systemPrompt = `Tu es un assistant amical et serviable pour Ayiti Marché RD, un marketplace pour la communauté haïtienne en République Dominicaine.

Tu parles français et créole selon la langue de l'utilisateur.
Tu es chaleureux, patient et toujours prêt à aider.

${dbContext}

Tu peux aider avec: recherche de produits, suivi de commandes, explication du processus d'achat, problèmes de livraison, rechargement du portefeuille, contact avec les vendeurs.

IMPORTANT: Utilise les données réelles ci-dessus pour donner des réponses personnalisées et précises. Par exemple, si l'utilisateur demande son solde, donne le vrai solde. Si il demande ses commandes, donne les vraies infos.

Utilise "nou" pour inclure l'utilisateur dans tes réponses. Sois encourageant et positif. Garde les réponses courtes et utiles.`;
      userPrompt = message;
    } else if (userType === "vendeur") {
      systemPrompt = `Tu es un assistant spécialisé pour les vendeurs sur Ayiti Marché RD.

${dbContext}

Tu aides avec: ajout et gestion des produits, préparation des commandes, communication avec les livreurs, problèmes de paiement et retraits, optimisation des ventes, résolution de litiges.

IMPORTANT: Utilise les données réelles ci-dessus. Si le vendeur demande ses stats, ses produits, ses commandes, donne les vrais chiffres. Donne des conseils personnalisés basés sur ses données réelles (ex: alerter sur les stocks bas, féliciter pour les ventes).

Donne des conseils pratiques et précis. Explique les procédures étape par étape. Sois encourageant et professionnel. Garde les réponses courtes.`;
      userPrompt = message;
    } else if (userType === "livreur") {
      systemPrompt = `Tu es un assistant pour les livreurs de Ayiti Marché RD.

${dbContext}

Tu aides avec: navigation et itinéraires, codes de vérification, relations avec vendeurs et clients, calcul des gains, signalement de problèmes, conseils de sécurité.

IMPORTANT: Utilise les données réelles ci-dessus. Informe le livreur de ses stats réelles, ses gains, les livraisons disponibles. Motive-le à prendre plus de livraisons.

Réponds de manière simple et directe. Priorise la sécurité et l'efficacité. Garde les réponses courtes.`;
      userPrompt = message;
    } else if (userType === "admin") {
      systemPrompt = `Tu es un assistant expert pour l'administrateur de Ayiti Marché RD.

${dbContext}

Tu aides avec: gestion des utilisateurs, modération, analyse des performances, détection de fraude, configuration de la plateforme, résolution de litiges.

IMPORTANT: Utilise les données réelles ci-dessus pour donner des analyses précises de la plateforme. Identifie les tendances, alerte sur les problèmes, propose des actions concrètes basées sur les vrais chiffres.

Sois précis, factuel et professionnel. Donne des recommandations actionnables.`;
      userPrompt = message;
    } else {
      systemPrompt = `Tu es un assistant expert pour Ayiti Marché RD, un marketplace. Réponds de manière utile et précise en français.${dbContext}`;
      userPrompt = message || data?.prompt || "Bonjour";
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && history.length > 0) {
      messages.push(...history.slice(-10));
    }

    messages.push({ role: "user", content: userPrompt });

    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
      stream: !useToolCalling,
    };

    if (useToolCalling) {
      const toolDef = getToolDefinition(action);
      if (toolDef) {
        body.tools = [toolDef];
        body.tool_choice = { type: "function", function: { name: toolDef.function.name } };
        body.stream = false;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans un moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (useToolCalling) {
      const result = await response.json();
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          return new Response(JSON.stringify({ success: true, analysis: parsed }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ success: true, analysis: { raw: toolCall.function.arguments } }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      const content = result.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ success: true, response: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getToolDefinition(action: string) {
  switch (action) {
    case "analyze-report":
      return {
        type: "function" as const,
        function: {
          name: "analyze_report",
          description: "Analyze a user report and provide recommendations",
          parameters: {
            type: "object",
            properties: {
              risk_level: { type: "string", enum: ["faible", "moyen", "élevé"] },
              recommendation: { type: "string", enum: ["approuver", "rejeter", "investiguer"] },
              reason: { type: "string", description: "Explication en français" },
              suggested_action: { type: "string", description: "Action concrète à prendre" },
              confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["risk_level", "recommendation", "reason", "suggested_action", "confidence"],
            additionalProperties: false,
          },
        },
      };
    case "verify-receipt":
      return {
        type: "function" as const,
        function: {
          name: "verify_receipt",
          description: "Verify a payment receipt",
          parameters: {
            type: "object",
            properties: {
              amount_found: { type: ["number", "null"] },
              transaction_id_found: { type: ["string", "null"] },
              date_found: { type: ["string", "null"] },
              is_valid: { type: "boolean" },
              anomalies: { type: "array", items: { type: "string" } },
              confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: ["is_valid", "anomalies", "confidence"],
            additionalProperties: false,
          },
        },
      };
    case "check-seller":
      return {
        type: "function" as const,
        function: {
          name: "check_seller",
          description: "Evaluate seller fraud risk",
          parameters: {
            type: "object",
            properties: {
              fraud_risk: { type: "number", minimum: 0, maximum: 100 },
              reliability_score: { type: "number", minimum: 0, maximum: 100 },
              recommendation: { type: "string", enum: ["approuver", "surveiller", "suspendre"] },
              red_flags: { type: "array", items: { type: "string" } },
              reason: { type: "string" },
            },
            required: ["fraud_risk", "reliability_score", "recommendation", "red_flags", "reason"],
            additionalProperties: false,
          },
        },
      };
    default:
      return null;
  }
}
