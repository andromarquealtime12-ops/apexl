import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, data, userType, message, context, history } = await req.json();

    let systemPrompt = "";
    let userPrompt = "";
    let temperature = 0.7;
    let useToolCalling = false;

    // ============ ADMIN ACTIONS ============
    if (action === "analyze-report") {
      systemPrompt = `Tu es un expert en modération de marketplace. Analyse les signalements et donne des recommandations objectives. Réponds TOUJOURS en français.`;
      userPrompt = `Analyse ce signalement :
Type: ${data.type}
Description: ${data.description}
Utilisateur signalé: Note ${data.userRating || "N/A"}/5, ${data.previousReports || 0} signalements précédents
Montant de la commande: ${data.orderAmount || "N/A"} RD$

Fournis une analyse structurée avec: niveau de risque, recommandation, raison, action suggérée, et confiance (0-100).`;
      temperature = 0.3;
      useToolCalling = true;
    } else if (action === "verify-receipt") {
      systemPrompt = `Tu es un expert en vérification de paiements. Analyse les reçus et détecte les anomalies.`;
      userPrompt = `Vérifie ce reçu :
Texte OCR: "${data.receiptText}"
Montant attendu: ${data.expectedAmount} RD$
ID transaction attendu: ${data.expectedTransactionId}

Fournis: montant trouvé, ID transaction trouvé, date trouvée, validité, anomalies et confiance.`;
      temperature = 0.2;
      useToolCalling = true;
    } else if (action === "check-seller") {
      systemPrompt = `Tu es un expert en détection de fraude pour marketplace.`;
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

Informations contextuelles:
- L'utilisateur a ${context?.cartItems || 0} articles dans son panier
- Il a ${context?.pastOrders || 0} commandes précédentes
- Solde portefeuille: ${context?.walletBalance || "non disponible"}

Tu peux aider avec: recherche de produits, suivi de commandes, explication du processus d'achat, problèmes de livraison, rechargement du portefeuille, contact avec les vendeurs.

Utilise "nou" pour inclure l'utilisateur dans tes réponses. Sois encourageant et positif. Garde les réponses courtes et utiles.`;
      userPrompt = message;
    } else if (userType === "vendeur") {
      systemPrompt = `Tu es un assistant spécialisé pour les vendeurs sur Ayiti Marché RD.

Tu aides avec: ajout et gestion des produits, préparation des commandes, communication avec les livreurs, problèmes de paiement et retraits, optimisation des ventes, résolution de litiges.

Informations contextuelles:
- Produits actifs: ${context?.activeProducts || 0}
- Commandes en attente: ${context?.pendingOrders || 0}
- Ventes totales: ${context?.totalSales || "N/A"}

Donne des conseils pratiques et précis. Explique les procédures étape par étape. Sois encourageant et professionnel. Garde les réponses courtes.`;
      userPrompt = message;
    } else if (userType === "livreur") {
      systemPrompt = `Tu es un assistant pour les livreurs de Ayiti Marché RD.

Tu aides avec: navigation et itinéraires, codes de vérification, relations avec vendeurs et clients, calcul des gains, signalement de problèmes, conseils de sécurité.

Informations contextuelles:
- Livraisons complétées: ${context?.completedDeliveries || 0}
- Gains totaux: ${context?.totalEarnings || "N/A"}

Réponds de manière simple et directe. Priorise la sécurité et l'efficacité. Garde les réponses courtes.`;
      userPrompt = message;
    } else if (userType === "admin") {
      systemPrompt = `Tu es un assistant expert pour l'administrateur de Ayiti Marché RD.

Tu aides avec: gestion des utilisateurs, modération, analyse des performances, détection de fraude, configuration de la plateforme, résolution de litiges.

Informations contextuelles:
- Utilisateurs totaux: ${context?.totalUsers || 0}
- Commandes aujourd'hui: ${context?.todayOrders || 0}
- Tickets ouverts: ${context?.openTickets || 0}

Sois précis, factuel et professionnel. Donne des recommandations actionnables.`;
      userPrompt = message;
    } else {
      systemPrompt = "Tu es un assistant expert pour Ayiti Marché RD, un marketplace. Réponds de manière utile et précise en français.";
      userPrompt = message || data?.prompt || "Bonjour";
    }

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && history.length > 0) {
      messages.push(...history.slice(-10)); // Keep last 10 messages for context
    }

    messages.push({ role: "user", content: userPrompt });

    // Build request body
    const body: Record<string, unknown> = {
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
      stream: !useToolCalling,
    };

    // For structured actions, use tool calling
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

    // For tool calling (structured responses), return JSON
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
      // Fallback to content
      const content = result.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ success: true, response: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For chat, stream the response
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
