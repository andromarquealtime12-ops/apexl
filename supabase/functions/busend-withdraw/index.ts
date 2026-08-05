// Automatic wallet withdrawal to a BUSEND account (HTG / DOP / USD)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUSEND_BASE = "https://busend.app/api/public/v1";
const CURRENCIES = ["HTG", "DOP", "USD"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("BUSEND_API_KEY");
    if (!apiKey) return json({ error: "BUSEND_API_KEY manquante" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);
    const currency = String(body?.currency || "").toUpperCase();
    const account = String(body?.accountNumber || "").trim();
    const note = String(body?.note || "").slice(0, 120);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return json({ error: "Montant invalide" }, 400);
    }
    if (!CURRENCIES.includes(currency)) {
      return json({ error: "Devise non supportée (HTG, DOP, USD)" }, 400);
    }
    if (!/^[A-Za-z0-9]{6,32}$/.test(account)) {
      return json({ error: "Numéro de compte BUSEND invalide" }, 400);
    }

    const busendHeaders = { "x-api-key": apiKey, "content-type": "application/json" };

    // 1. Verify the beneficiary exists
    const lookupRes = await fetch(
      `${BUSEND_BASE}/lookup?account_number=${encodeURIComponent(account)}`,
      { headers: busendHeaders },
    );
    const lookupBody = await lookupRes.text();
    if (!lookupRes.ok) {
      console.error(`BUSEND lookup failed [${lookupRes.status}]: ${lookupBody}`);
      return json(
        { error: "Bénéficiaire BUSEND introuvable", status: lookupRes.status, details: lookupBody },
        lookupRes.status,
      );
    }
    const beneficiary = JSON.parse(lookupBody || "{}");

    // 2. Debit the wallet (creates a pending withdrawal transaction)
    const { data: reqRes, error: reqErr } = await userClient.rpc("request_withdrawal" as any, {
      p_amount: amount,
      p_currency: currency,
      p_payment_method: "bank_other",
      p_account_details: `BUSEND ${account}${beneficiary?.holder ? ` (${beneficiary.holder})` : ""}`,
    });
    if (reqErr) throw reqErr;
    const r = reqRes as any;
    if (!r?.success) return json({ error: r?.error || "Retrait refusé" }, 400);
    const txId = r.transaction_id || r.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 3. Send the money through BUSEND
    try {
      const res = await fetch(`${BUSEND_BASE}/transfers`, {
        method: "POST",
        headers: busendHeaders,
        body: JSON.stringify({
          to_account_number: account,
          currency,
          amount,
          note: note || `Retrait APEXL ${userId.slice(0, 8)}`,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`BUSEND transfer failed [${res.status}]: ${text}`);
        if (txId) {
          await admin.rpc("reject_withdrawal" as any, {
            p_transaction_id: txId,
            p_reason: `BUSEND: ${text.slice(0, 200)}`,
          });
        }
        return json(
          { error: "Transfert BUSEND échoué", status: res.status, details: text },
          res.status,
        );
      }
      const transfer = JSON.parse(text || "{}");
      if (txId) {
        await admin
          .from("wallet_transactions")
          .update({ transaction_reference: transfer?.transaction_id || null })
          .eq("id", txId);
      }
      return json({ success: true, transfer, transaction_id: txId, beneficiary });
    } catch (e: any) {
      if (txId) {
        await admin.rpc("reject_withdrawal" as any, {
          p_transaction_id: txId,
          p_reason: `BUSEND erreur: ${e.message}`.slice(0, 200),
        });
      }
      throw e;
    }
  } catch (e: any) {
    console.error("busend-withdraw:", e);
    return json({ error: e?.message || "Erreur" }, 500);
  }
});
