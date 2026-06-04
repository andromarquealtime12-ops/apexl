import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret || !signature) {
      console.error("Webhook rejected: missing secret or signature");
      return new Response(JSON.stringify({ error: "Webhook signature required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status === "paid" && session.metadata) {
        const userId = session.metadata.user_id;
        const amount = parseFloat(session.metadata.amount);
        const currency = session.metadata.currency;

        if (!userId || !amount || !currency) {
          console.error("Missing metadata", session.metadata);
          return new Response(JSON.stringify({ error: "Missing metadata" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Use service role to update wallet
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Idempotency: skip if this session was already processed
        const { data: existingTx } = await supabaseAdmin
          .from("wallet_transactions")
          .select("id")
          .eq("transaction_reference", session.id)
          .maybeSingle();
        if (existingTx) {
          console.log("Stripe session already processed, skipping:", session.id);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const balanceCol =
          currency === "DOP"
            ? "balance_dop"
            : currency === "HTG"
            ? "balance_htg"
            : "balance_usd";

        // Get wallet
        const { data: wallet, error: walletErr } = await supabaseAdmin
          .from("wallets")
          .select("id, " + balanceCol)
          .eq("user_id", userId)
          .single();

        if (walletErr || !wallet) {
          console.error("Wallet not found:", walletErr);
          return new Response(
            JSON.stringify({ error: "Wallet not found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Credit wallet
        const currentBalance = (wallet as any)[balanceCol] || 0;
        const { error: updateErr } = await supabaseAdmin
          .from("wallets")
          .update({ [balanceCol]: currentBalance + amount, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);

        if (updateErr) {
          console.error("Failed to update wallet:", updateErr);
          return new Response(
            JSON.stringify({ error: "Failed to credit wallet" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Record transaction
        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          type: "deposit",
          amount,
          currency,
          status: "completed",
          payment_method: "card_visa",
          description: `Paiement par carte Stripe`,
          transaction_reference: session.id,
        });

        // Notify user
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          title: "💳 Paiement reçu !",
          message: `Votre portefeuille a été crédité de ${amount} ${currency} via carte bancaire.`,
          type: "success",
        });

        console.log(
          `Wallet credited: ${amount} ${currency} for user ${userId}`
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
