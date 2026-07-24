// Create a MonCash deposit via Bazik.io — returns redirect URL
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BAZIK_BASE = "https://api.bazik.io";

async function getBazikToken(): Promise<string> {
  const res = await fetch(`${BAZIK_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userID: Deno.env.get("BAZIK_USER_ID"),
      secretKey: Deno.env.get("BAZIK_SECRET_KEY"),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bazik token failed [${res.status}]: ${text}`);
  let j: any = {};
  try { j = JSON.parse(text); } catch { throw new Error(`Bazik token non-JSON: ${text.slice(0, 200)}`); }
  const token = j.access_token || j.token || j.accessToken || j.data?.token || j.data?.access_token;
  if (!token) throw new Error(`Bazik token missing in response: ${text.slice(0, 200)}`);
  console.log("Bazik token acquired, length:", token.length);
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const description = String(body.description || "Recharge portefeuille APEXL");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 75000) {
      return new Response(JSON.stringify({ error: "Montant invalide (1-75000 HTG)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get wallet and user profile
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: wallet } = await admin.from("wallets").select("id").eq("user_id", userId).single();
    if (!wallet) throw new Error("Wallet introuvable");
    const { data: profile } = await admin
      .from("profiles").select("full_name, email").eq("user_id", userId).maybeSingle();

    const referenceId = `APEXL_${userId.slice(0, 8)}_${Date.now()}`;

    // Create pending transaction FIRST so webhook can find it
    const { data: tx, error: txErr } = await admin.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "deposit",
      amount,
      currency: "HTG",
      payment_method: "moncash",
      status: "pending",
      description: `Dépôt MonCash via Bazik (${referenceId})`,
      transaction_reference: referenceId,
    }).select().single();
    if (txErr) throw txErr;

    // Call Bazik
    const token = await getBazikToken();
    const nameParts = (profile?.full_name || "APEXL User").split(" ");
    const bazikRes = await fetch(`${BAZIK_BASE}/moncash/token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        gdes: amount,
        description,
        referenceId,
        customerFirstName: nameParts[0] || "APEXL",
        customerLastName: nameParts.slice(1).join(" ") || "User",
        customerEmail: profile?.email || claims.claims.email || "noreply@apexl.app",
        metadata: {
          webhookUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/bazik-webhook`,
          userId,
          transactionId: tx.id,
        },
      }),
    });

    const bazikJson = await bazikRes.json().catch(() => ({}));
    if (!bazikRes.ok) {
      await admin.from("wallet_transactions").update({
        status: "failed",
        description: `Bazik erreur: ${JSON.stringify(bazikJson).slice(0, 200)}`,
      }).eq("id", tx.id);
      return new Response(JSON.stringify({ error: "Bazik", details: bazikJson }), {
        status: bazikRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store Bazik orderId/transactionId in the tx for correlation
    const bazikRef = bazikJson.orderId || bazikJson.transactionId || null;
    if (bazikRef) {
      await admin.from("wallet_transactions").update({
        transaction_reference: bazikRef,
        description: `Dépôt MonCash via Bazik (ref: ${referenceId})`,
      }).eq("id", tx.id);
    }

    const redirectUrl =
      bazikJson.paymentUrl || bazikJson.payment_url || bazikJson.redirectUrl ||
      bazikJson.redirect_url || bazikJson.url || bazikJson.checkoutUrl;

    return new Response(JSON.stringify({
      success: true,
      redirectUrl,
      referenceId,
      bazik: bazikJson,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("bazik-deposit:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
