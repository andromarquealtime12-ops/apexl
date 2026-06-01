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

    const { data: profile } = await supabase
      .from("profiles").select("full_name, phone, address, city")
      .eq("id", order.buyer_id).maybeSingle();

    const recipient = {
      name: profile?.full_name || "Customer",
      address1: order.delivery_address || profile?.address || "",
      city: order.delivery_city || profile?.city || "",
      country_code: order.delivery_country || "DO",
      phone: profile?.phone || "",
      email: order.buyer_email || undefined,
    };

    const pfHeaders: Record<string, string> = {
      Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (PRINTFUL_STORE_ID) pfHeaders["X-PF-Store-Id"] = PRINTFUL_STORE_ID;

    const orderPayload = {
      external_id: order.id,
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
      throw new Error(`Printful order error [${res.status}]: ${JSON.stringify(json)}`);
    }

    // Store Printful order id on the order for tracking
    await supabase.from("orders").update({
      shopify_order_id: `printful:${json.result?.id}`, // reuse column for external ref
    }).eq("id", order.id);

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
