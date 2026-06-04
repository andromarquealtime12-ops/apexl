import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
    } = await supabaseClient.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, currency, returnOrigin } = await req.json();

    if (!amount || amount <= 0 || amount > 100000) {
      return new Response(
        JSON.stringify({ error: "Invalid amount (1 - 100,000)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["DOP", "HTG", "USD"].includes(currency)) {
      return new Response(JSON.stringify({ error: "Invalid currency" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Stripe account is in Canada → charge in CAD.
    // Convert the wallet currency (DOP/HTG/USD) to CAD using a live FX rate.
    // Wallet will still be credited in the original currency after payment.
    let fxRate = 0;
    try {
      const fxRes = await fetch(`https://open.er-api.com/v6/latest/${currency}`);
      const fxJson = await fxRes.json();
      fxRate = fxJson?.rates?.CAD;
      if (!fxRate || typeof fxRate !== "number") throw new Error("No CAD rate");
    } catch (e) {
      console.error("FX fetch failed:", e);
      return new Response(
        JSON.stringify({ error: "Impossible de récupérer le taux de change vers CAD" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cadAmount = Math.round(amount * fxRate * 100) / 100; // 2 decimals
    if (cadAmount < 0.5) {
      return new Response(
        JSON.stringify({ error: "Montant trop faible (minimum ~0.50 CAD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const stripeCurrency = "cad";

    // Check if customer exists
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    // Strict allowlist for redirect URLs (prevent open redirect)
    const ALLOWED_ORIGINS = [
      "https://marketayiti.lovable.app",
      "https://marketayiti.shop",
      "https://www.marketayiti.shop",
      "https://id-preview--37a123cb-9a28-4232-83d4-4ade597e3626.lovable.app",
    ];
    const requestOrigin = req.headers.get("origin");
    const pick = (o: unknown) =>
      typeof o === "string" && ALLOWED_ORIGINS.includes(o) ? o : null;
    const appOrigin = pick(returnOrigin) ?? pick(requestOrigin) ?? ALLOWED_ORIGINS[0];

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Recharge portefeuille - ${currency}`,
              description: `Ajout de ${amount} ${currency} (≈ ${cadAmount} CAD au taux ${fxRate.toFixed(4)}) à votre portefeuille Ayiti Market`,
            },
            unit_amount: Math.round(cadAmount * 100), // CAD cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appOrigin}/wallet?stripe_success=true`,
      cancel_url: `${appOrigin}/wallet?stripe_cancel=true`,
      metadata: {
        user_id: user.id,
        amount: amount.toString(),
        currency,
        cad_amount: cadAmount.toString(),
        fx_rate: fxRate.toString(),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
