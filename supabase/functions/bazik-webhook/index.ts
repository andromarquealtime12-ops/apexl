// Bazik.io webhook receiver — verifies HMAC and credits/refunds wallet
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac, timingSafeEqual } from "node:crypto";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const secret = Deno.env.get("BAZIK_WEBHOOK_SECRET");
  const timestamp = req.headers.get("x-bazik-timestamp") || "";
  const eventId = req.headers.get("x-bazik-event-id") || "";
  const signatureHeader = req.headers.get("x-bazik-signature") || "";

  if (!secret) {
    console.error("BAZIK_WEBHOOK_SECRET missing");
    return new Response("Server misconfigured", { status: 500 });
  }

  // Verify signature: v1=<hmac_sha256(secret, timestamp.eventId.body)>
  try {
    const signedPayload = `${timestamp}.${eventId}.${rawBody}`;
    const expected = "v1=" + createHmac("sha256", secret).update(signedPayload).digest("hex");
    const a = new TextEncoder().encode(expected);
    const b = new TextEncoder().encode(signatureHeader);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.warn("bazik-webhook: invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } catch (e) {
    console.error("signature check failed", e);
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const type: string = payload.type || "";
  const referenceId: string = payload.referenceId || "";
  const orderOrTxRef: string = payload.orderId || payload.transactionId || "";
  const amount = Number(payload.amount);
  const currency = payload.currency || "HTG";

  // Find our local transaction by either our internal reference or the Bazik ref stored earlier
  const { data: txs } = await admin
    .from("wallet_transactions")
    .select("id, wallet_id, status, amount, currency, type")
    .or(`transaction_reference.eq.${referenceId},transaction_reference.eq.${orderOrTxRef}`)
    .limit(1);
  const tx = txs?.[0];
  if (!tx) {
    console.warn("bazik-webhook: transaction not found", { referenceId, orderOrTxRef });
    return new Response("OK", { status: 200 });
  }
  if (tx.status !== "pending") {
    return new Response("Already processed", { status: 200 });
  }

  const { data: wallet } = await admin
    .from("wallets").select("user_id").eq("id", tx.wallet_id).single();
  if (!wallet) return new Response("Wallet not found", { status: 200 });

  // === Payment (deposit) events ===
  if (type === "payment.succeeded") {
    // Credit wallet atomically
    const { error } = await admin.rpc("credit_wallet_atomic", {
      p_user_id: wallet.user_id,
      p_amount: amount || tx.amount,
      p_currency: currency,
      p_payment_method: "moncash",
      p_description: "Dépôt MonCash Bazik confirmé",
      p_transaction_reference: orderOrTxRef || referenceId,
    });
    if (error) {
      console.error("credit_wallet_atomic:", error);
      return new Response("DB error", { status: 500 });
    }
    // Mark our pending tx as completed (credit_wallet creates its own; we just close ours)
    await admin.from("wallet_transactions").update({
      status: "completed", description: "Dépôt MonCash confirmé par Bazik",
    }).eq("id", tx.id);
    return new Response("OK", { status: 200 });
  }

  if (type === "payment.failed" || type === "payment.cancelled") {
    await admin.from("wallet_transactions").update({
      status: "failed", description: `MonCash ${type}`,
    }).eq("id", tx.id);
    return new Response("OK", { status: 200 });
  }

  // === Transfer (withdrawal) events ===
  if (type === "transfer.succeeded") {
    await admin.from("wallet_transactions").update({
      status: "completed", description: "Retrait MonCash envoyé via Bazik",
    }).eq("id", tx.id);
    return new Response("OK", { status: 200 });
  }

  if (type === "transfer.failed") {
    // Refund wallet via reject_withdrawal (admin-guarded RPC). Use direct refund instead.
    const reason = payload.failureReason || "Transfert Bazik échoué";
    // Refund by crediting the wallet with the failed amount, mark tx failed
    await admin.rpc("credit_wallet_atomic", {
      p_user_id: wallet.user_id,
      p_amount: tx.amount,
      p_currency: tx.currency,
      p_payment_method: "moncash",
      p_description: `Remboursement retrait échoué: ${reason}`,
      p_transaction_reference: `refund_${tx.id}`,
    });
    await admin.from("wallet_transactions").update({
      status: "failed", description: `Retrait échoué: ${reason}`,
    }).eq("id", tx.id);
    return new Response("OK", { status: 200 });
  }

  return new Response("OK", { status: 200 });
});
