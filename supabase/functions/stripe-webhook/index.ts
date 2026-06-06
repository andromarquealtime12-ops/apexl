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

        // Atomic + idempotent wallet credit (prevents race conditions between
        // concurrent payment events that could otherwise double-credit or
        // overwrite each other via read-then-write).
        const { data: creditResult, error: creditErr } = await supabaseAdmin.rpc(
          "credit_wallet_atomic",
          {
            p_user_id: userId,
            p_amount: amount,
            p_currency: currency,
            p_payment_method: "card_visa",
            p_description: "Paiement par carte Stripe",
            p_transaction_reference: session.id,
          }
        );

        if (creditErr) {
          console.error("credit_wallet_atomic error:", creditErr);
          return new Response(JSON.stringify({ error: "Failed to credit wallet" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if ((creditResult as any)?.idempotent) {
          console.log("Stripe session already processed, skipping:", session.id);
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!(creditResult as any)?.success) {
          console.error("credit_wallet_atomic returned:", creditResult);
          return new Response(JSON.stringify({ error: "Wallet credit failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
