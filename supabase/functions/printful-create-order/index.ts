import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRINTFUL_API = "https://api.printful.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PRINTFUL_API_KEY = Deno.env.get("PRINTFUL_API_KEY");
    if (!PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY not configured");
    const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id required");

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*, products(name, printful_variant_id, is_printful))")
      .eq("id", order_id).single();
    if (orderErr || !order) throw new Error("Order not found");

    // Skip if already forwarded
    if (order.shopify_order_id && String(order.shopify_order_id).startsWith("printful:")) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const printfulItems = (order.order_items || []).filter((it: any) => it.products?.is_printful);
    if (printfulItems.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = printfulItems.map((it: any) => ({
      sync_variant_id: Number(it.products.printful_variant_id),
      quantity: it.quantity,
      retail_price: String(it.unit_price),
    }));

    // Get buyer email from auth + profile
    const { data: profile } = await supabase
      .from("profiles").select("full_name, phone, address, city, user_id")
      .eq("id", order.buyer_id).maybeSingle();

    let email: string | undefined;
    if (profile?.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      email = userData?.user?.email;
    }

    const recipient: Record<string, any> = {
      name: profile?.full_name || "Customer",
      address1: order.delivery_address || profile?.address || "",
      address2: order.delivery_address2 || undefined,
      city: order.delivery_city || profile?.city || "",
      state_code: order.delivery_state || undefined,
      zip: order.delivery_zip || undefined,
      country_code: order.delivery_country || "DO",
      phone: profile?.phone || "",
    };
    // Remove undefined keys for clean payload
    Object.keys(recipient).forEach(k => recipient[k] === undefined && delete recipient[k]);
    if (email) recipient.email = email;

    const pfHeaders: Record<string, string> = {
      Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (PRINTFUL_STORE_ID) pfHeaders["X-PF-Store-Id"] = PRINTFUL_STORE_ID;

    // Printful external_id max length is 32 chars — strip dashes from UUID
    const externalId = String(order.id).replace(/-/g, "").slice(0, 32);

    const orderPayload = {
      external_id: externalId,
      recipient,
      items,
      retail_costs: { currency: "USD" },
    };

    const res = await fetch(`${PRINTFUL_API}/orders?confirm=true`, {
      method: "POST",
      headers: pfHeaders,
      body: JSON.stringify(orderPayload),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Printful API error:", res.status, JSON.stringify(json));
      throw new Error(`Printful order error [${res.status}]: ${JSON.stringify(json)}`);
    }

    await supabase.from("orders").update({
      shopify_order_id: `printful:${json.result?.id}`,
    }).eq("id", order.id);

    console.log(`Printful order created: ${json.result?.id} for order ${order.id}`);

    return new Response(JSON.stringify({ success: true, printful_order_id: json.result?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("printful-create-order error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
