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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error('Unauthorized');

    // Verify user is a seller
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isSeller = roles?.some((r: any) => r.role === 'seller' || r.role === 'admin');
    if (!isSeller) throw new Error('Only sellers can sync Shopify products');

    // Fetch products from Shopify Admin API
    const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/products.json?limit=250`;
    const shopRes = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    if (!shopRes.ok) {
      const errText = await shopRes.text();
      throw new Error(`Shopify API error [${shopRes.status}]: ${errText}`);
    }
    const { products: shopifyProducts } = await shopRes.json();

    let imported = 0;
    for (const sp of shopifyProducts || []) {
      const variant = sp.variants?.[0];
      if (!variant) continue;
      const price = parseFloat(variant.price || '0');
      const stock = variant.inventory_quantity ?? 0;
      const image = sp.image?.src || sp.images?.[0]?.src || null;

      // Upsert by shopify_product_id
      const { data: existing } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('shopify_product_id', String(sp.id))
        .maybeSingle();

      const payload: any = {
        seller_id: user.id,
        name: sp.title,
        description: sp.body_html?.replace(/<[^>]+>/g, '').slice(0, 1000) || '',
        price,
        stock_quantity: stock,
        image_url: image,
        is_shopify: true,
        shopify_product_id: String(sp.id),
        shopify_variant_id: String(variant.id),
        available_countries: ['DO', 'HT'],
        is_active: sp.status === 'active',
        category: sp.product_type || 'Shopify',
      };

      if (existing) {
        // Never allow a seller to take over another seller's synced product
        if (existing.seller_id && existing.seller_id !== user.id) {
          console.warn('Skipping product owned by another seller:', existing.id);
          continue;
        }
        const { seller_id: _omit, ...updatePayload } = payload;
        await supabase.from('products').update(updatePayload).eq('id', existing.id).eq('seller_id', user.id);
      } else {
        await supabase.from('products').insert(payload);
      }
      imported++;
    }

    // Update connection sync timestamp
    await supabase.from('shopify_connections').upsert({
      seller_id: user.id,
      shop_domain: SHOPIFY_STORE_DOMAIN,
      last_sync_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'seller_id' });

    return new Response(JSON.stringify({ success: true, imported }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('shopify-sync-products error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
