import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
    const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET");
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      throw new Error("PayPal credentials not configured");
    }

    const { action, order_id, amount, currency, user_id } = await req.json();
    const PAYPAL_API = "https://api-m.paypal.com"; // Live mode

    // Get PayPal access token
    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("PayPal token error:", tokenData);
      throw new Error("Failed to get PayPal access token");
    }
    const accessToken = tokenData.access_token;

    if (action === "create_order") {
      // Map currency - PayPal uses standard ISO codes
      const paypalCurrency = currency === "DOP" ? "USD" : currency === "HTG" ? "USD" : currency;
      // Convert amount to USD if needed (approximate rates)
      let usdAmount = amount;
      if (currency === "DOP") usdAmount = (amount / 58).toFixed(2);
      else if (currency === "HTG") usdAmount = (amount / 132).toFixed(2);
      else usdAmount = amount.toFixed(2);

      const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: usdAmount.toString(),
              },
              description: `Ayiti Marché RD - Recharge portefeuille`,
            },
          ],
          application_context: {
            brand_name: "Ayiti Marché RD",
            landing_page: "NO_PREFERENCE",
            user_action: "PAY_NOW",
            return_url: "https://marketayiti.lovable.app/checkout?paypal=success",
            cancel_url: "https://marketayiti.lovable.app/checkout?paypal=cancel",
          },
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        console.error("PayPal create order error:", orderData);
        throw new Error("Failed to create PayPal order");
      }

      return new Response(JSON.stringify({ success: true, order: orderData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "capture_order") {
      const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${order_id}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        console.error("PayPal capture error:", captureData);
        throw new Error("Failed to capture PayPal payment");
      }

      if (captureData.status === "COMPLETED") {
        // Credit the user's wallet
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const capturedAmount = parseFloat(
          captureData.purchase_units[0].payments.captures[0].amount.value
        );
        
        // Convert USD back to local currency for wallet credit
        let localAmount = capturedAmount;
        if (currency === "DOP") localAmount = capturedAmount * 58;
        else if (currency === "HTG") localAmount = capturedAmount * 132;

        const balanceField = currency === "DOP" ? "balance_dop" : currency === "HTG" ? "balance_htg" : "balance_usd";

        // Get wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, " + balanceField)
          .eq("user_id", user_id)
          .single();

        if (wallet) {
          const currentBalance = (wallet as any)[balanceField] || 0;
          await supabase
            .from("wallets")
            .update({ [balanceField]: currentBalance + localAmount, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);

          // Create transaction record
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            type: "deposit",
            amount: localAmount,
            currency: currency,
            status: "completed",
            payment_method: "paypal",
            description: `Paiement PayPal - $${capturedAmount} USD`,
            transaction_reference: order_id,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, capture: captureData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PayPal error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
