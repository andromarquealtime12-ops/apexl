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
    const PRINTFUL_STORE_ID = Deno.env.get("PRINTFUL_STORE_ID"); // optional

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "seller");
    if (!isAdmin) throw new Error("Only admin/seller can sync Printful");

    const pfHeaders: Record<string, string> = {
      Authorization: `Bearer ${PRINTFUL_API_KEY}`,
      "Content-Type": "application/json",
    };
    if (PRINTFUL_STORE_ID) pfHeaders["X-PF-Store-Id"] = PRINTFUL_STORE_ID;

    // List store sync products
    const listRes = await fetch(`${PRINTFUL_API}/store/products?limit=100`, { headers: pfHeaders });
    if (!listRes.ok) {
      const t = await listRes.text();
      throw new Error(`Printful list error [${listRes.status}]: ${t}`);
    }
    const listJson = await listRes.json();
    const products = listJson.result || [];

    let imported = 0;
    for (const p of products) {
      // Fetch detail to get variants
      const detRes = await fetch(`${PRINTFUL_API}/store/products/${p.id}`, { headers: pfHeaders });
      if (!detRes.ok) continue;
      const det = (await detRes.json()).result;
      const syncProduct = det.sync_product;
      const syncVariants = det.sync_variants || [];
      if (!syncVariants.length) continue;

      const firstVariant = syncVariants[0];
      const price = parseFloat(firstVariant.retail_price || "0");
      const image = syncProduct.thumbnail_url || firstVariant.files?.find((f: any) => f.type === "preview")?.preview_url || null;

      const sizes = Array.from(new Set(syncVariants.map((v: any) => v.size).filter(Boolean)));
      const colors = Array.from(new Set(syncVariants.map((v: any) => v.color).filter(Boolean)));

      const payload: any = {
        seller_id: user.id,
        name: syncProduct.name,
        description: `Produit imprimé à la demande par Printful. Livraison mondiale directe.`,
        price,
        currency: "USD",
        stock_quantity: 9999,
        images: image ? [image] : [],
        is_printful: true,
        printful_product_id: String(syncProduct.id),
        printful_variant_id: String(firstVariant.id),
        available_countries: ["DO", "HT", "US", "CA", "FR"],
        available_sizes: sizes,
        available_colors: colors,
        is_active: !syncProduct.is_ignored,
      };

      const { data: existing } = await supabase
        .from("products").select("id")
        .eq("printful_product_id", String(syncProduct.id))
        .maybeSingle();

      if (existing) {
        await supabase.from("products").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("products").insert(payload);
      }
      imported++;
    }

    return new Response(JSON.stringify({ success: true, imported }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("printful-sync-products error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
