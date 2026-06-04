import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const SHOPIFY_ADMIN_API_TOKEN = Deno.env.get('SHOPIFY_ADMIN_API_TOKEN');
    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_API_TOKEN) {
      throw new Error('Shopify credentials not configured');
    }

    // === Authenticate caller ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = authData.user.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { order_id } = await req.json();
    if (!order_id) throw new Error('order_id required');

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, shopify_variant_id, is_shopify))')
      .eq('id', order_id)
      .single();
    if (orderErr || !order) throw new Error('Order not found');

    // Authorization: only the buyer of the order or an admin can trigger Shopify order creation
    if (order.buyer_id !== callerId) {
      const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: callerId, _role: 'admin' });
      if (!isAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Idempotency: don't re-create if a Shopify order already exists
    if ((order as any).shopify_order_id) {
      return new Response(JSON.stringify({
        success: true,
        idempotent: true,
        shopify_order_id: (order as any).shopify_order_id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const shopifyItems = (order.order_items || []).filter((it: any) => it.products?.is_shopify);
    if (shopifyItems.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, message: 'No Shopify items' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const line_items = shopifyItems.map((it: any) => ({
      variant_id: Number(it.products.shopify_variant_id),
      quantity: it.quantity,
    }));

    // Get buyer profile for address
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, address, city')
      .eq('id', order.buyer_id)
      .maybeSingle();

    const shipping_address = {
      first_name: profile?.full_name || 'Customer',
      address1: order.delivery_address || profile?.address || '',
      city: order.delivery_city || profile?.city || '',
      country: order.delivery_country || 'DO',
      phone: profile?.phone || '',
    };

    const orderPayload = {
      order: {
        line_items,
        shipping_address,
        billing_address: shipping_address,
        financial_status: 'paid',
        note: `Ayiti Market order #${order.id}`,
        tags: 'ayiti-market',
      },
    };

    const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/orders.json`;
    const shopRes = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const shopData = await shopRes.json();
    if (!shopRes.ok) {
      throw new Error(`Shopify order creation failed [${shopRes.status}]: ${JSON.stringify(shopData)}`);
    }

    // Save Shopify order reference
    await supabase
      .from('orders')
      .update({
        shopify_order_id: String(shopData.order.id),
        shopify_order_number: String(shopData.order.order_number || shopData.order.name),
      })
      .eq('id', order_id);

    return new Response(JSON.stringify({
      success: true,
      shopify_order_id: shopData.order.id,
      shopify_order_number: shopData.order.order_number,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('shopify-create-order error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
