// Auto MonCash withdrawal via Bazik.io transfers
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
  if (!token) throw new Error(`Bazik token missing: ${text.slice(0, 200)}`);
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
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const { amount, phoneNumber, firstName, lastName } = await req.json();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 75000) {
      return new Response(JSON.stringify({ error: "Montant invalide (1-75000 HTG)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const phone = String(phoneNumber || "").replace(/\D/g, "");
    if (phone.length < 8) {
      return new Response(JSON.stringify({ error: "Numéro MonCash invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Deduct via request_withdrawal (uses caller's session for auth.uid())
    const { data: reqRes, error: reqErr } = await userClient.rpc(
      "request_withdrawal" as any,
      {
        p_amount: amt,
        p_currency: "HTG",
        p_payment_method: "moncash",
        p_account_details: `MonCash ${phone}`,
      },
    );
    if (reqErr) throw reqErr;
    const r = reqRes as any;
    if (!r?.success) {
      return new Response(JSON.stringify({ error: r?.error || "Retrait refusé" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const txId = r.transaction_id || r.id;
    const referenceId = `APEXL_W_${userId.slice(0, 8)}_${Date.now()}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (txId) {
      await admin.from("wallet_transactions").update({
        transaction_reference: referenceId,
      }).eq("id", txId);
    }

    // 2. Trigger Bazik transfer
    try {
      const token = await getBazikToken();
      const res = await fetch(`${BAZIK_BASE}/transfers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          currency: "HTG",
          wallet: "moncash",
          recipient: {
            firstName: firstName || "APEXL",
            lastName: lastName || "User",
            phoneNumber: phone.startsWith("509") ? phone : `509${phone}`,
          },
          referenceId,
          webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/bazik-webhook`,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Auto-refund by approving reject on the pending tx
        if (txId) {
          await admin.rpc("reject_withdrawal" as any, {
            p_transaction_id: txId,
            p_reason: `Bazik: ${JSON.stringify(j).slice(0, 200)}`,
          });
        }
        return new Response(JSON.stringify({ error: "Bazik", details: j }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, bazik: j, transaction_id: txId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      if (txId) {
        await admin.rpc("reject_withdrawal" as any, {
          p_transaction_id: txId,
          p_reason: `Bazik erreur: ${e.message}`.slice(0, 200),
        });
      }
      throw e;
    }
  } catch (e: any) {
    console.error("bazik-withdraw:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
