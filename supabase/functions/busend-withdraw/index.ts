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
    const mode = String(body?.mode || "transfer");
    const amount = Number(body?.amount);
    const currency = String(body?.currency || "").toUpperCase();
    const account = String(body?.accountNumber || "").trim();
    const note = String(body?.note || "").slice(0, 120);

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
      return json({
        error: "Bénéficiaire BUSEND introuvable — vérifiez le numéro de compte",
        status: lookupRes.status,
        details: lookupBody.slice(0, 300),
      });
    }

    const beneficiary = JSON.parse(lookupBody || "{}");
    const holderName =
      beneficiary?.holder || beneficiary?.name || beneficiary?.full_name ||
      beneficiary?.account_name || beneficiary?.data?.name || null;

    // Lookup-only mode: return the beneficiary name for confirmation
    if (mode === "lookup") {
      return json({ success: true, beneficiary, holder_name: holderName });
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return json({ error: "Montant invalide" }, 400);
    }
    if (!CURRENCIES.includes(currency)) {
      return json({ error: "Devise non supportée (HTG, DOP, USD)" }, 400);
    }
    if (!holderName) {
      return json({ error: "Nom du bénéficiaire introuvable — vérifiez le numéro de compte" }, 400);
    }


    // 2. Debit the wallet (creates a pending withdrawal transaction)
    const { data: reqRes, error: reqErr } = await userClient.rpc("request_withdrawal" as any, {
      p_amount: amount,
      p_currency: currency,
      p_payment_method: "bank_other",
      p_account_details: `BUSEND ${account} (${holderName})`,
    });
    if (reqErr) throw reqErr;
    const r = reqRes as any;
    if (!r?.success) {
      const raw = String(r?.error || "");
      let msg = raw || "Retrait refusé";
      if (raw.includes("Insufficient balance")) {
        msg = `Solde ${currency} insuffisant dans votre portefeuille pour retirer ${amount} ${currency}.`;
      } else if (raw.includes("frozen")) {
        msg = "Votre portefeuille est gelé. Contactez le support.";
      } else if (raw.includes("Wallet not found")) {
        msg = "Portefeuille introuvable.";
      }
      // 200 so the client displays this message instead of a generic non-2xx error
      return json({ error: msg });
    }

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
        let refunded = false;
        if (txId) {
          const { data: rej, error: rejErr } = await admin.rpc("reject_withdrawal" as any, {
            p_transaction_id: txId,
            p_reason: `BUSEND: ${text.slice(0, 200)}`,
          });
          refunded = !rejErr && (rej as any)?.success === true;
          if (!refunded) console.error("Refund failed:", rejErr || rej);
        }
        let msg = "Transfert BUSEND échoué";
        if (text.includes("self_transfer")) {
          msg =
            "Ce numéro de compte BUSEND est celui de la plateforme APEXL. Entrez le numéro de VOTRE compte BUSEND personnel (différent du compte émetteur).";
        } else if (text.includes("insufficient_funds")) {
          msg = "Fonds insuffisants sur le compte BUSEND de la plateforme. Réessayez plus tard.";
        } else if (text.includes("not_found") || res.status === 404) {
          msg = "Compte destinataire BUSEND introuvable.";
        }
        if (refunded) msg += " Votre solde a été remboursé.";
        // Return 200 so the client shows this message instead of a generic error
        return json({ error: msg, refunded, status: res.status, details: text.slice(0, 300) });
      }

      const transfer = JSON.parse(text || "{}");
      // Auto-complete: no admin approval needed, BUSEND already sent the funds
      if (txId) {
        await admin
          .from("wallet_transactions")
          .update({
            transaction_reference: transfer?.transaction_id || transfer?.id || null,
            status: "completed",
            description: `Retrait BUSEND automatique vers ${holderName} (${account})`,
          })
          .eq("id", txId);

        await admin.from("notifications").insert({
          user_id: userId,
          title: "Retrait BUSEND effectué ✓",
          message: `Votre retrait de ${amount} ${currency} a été envoyé automatiquement à ${holderName} (compte ${account}).`,
          type: "success",
        });
      }
      return json({
        success: true,
        transfer,
        transaction_id: txId,
        beneficiary,
        holder_name: holderName,
      });

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
