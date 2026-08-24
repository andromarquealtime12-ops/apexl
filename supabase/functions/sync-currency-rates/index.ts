import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CURRENCIES = ["USD", "DOP", "HTG"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const rates: { from_currency: string; to_currency: string; rate: number }[] = [];

    for (const base of CURRENCIES) {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      const json = await res.json();
      if (json?.result !== "success" || !json?.rates) continue;
      for (const target of CURRENCIES) {
        if (target === base) continue;
        const r = json.rates[target];
        if (typeof r === "number" && r > 0) {
          rates.push({ from_currency: base, to_currency: target, rate: Math.round(r * 10000) / 10000 });
        }
      }
    }

    if (rates.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Aucun taux disponible" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const r of rates) {
      const { data: existing } = await supabase
        .from("currency_rates")
        .select("id")
        .eq("from_currency", r.from_currency)
        .eq("to_currency", r.to_currency)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("currency_rates")
          .update({ rate: r.rate, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("currency_rates").insert({ ...r, updated_at: new Date().toISOString() });
      }
    }

    return new Response(JSON.stringify({ success: true, updated: rates.length, rates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-currency-rates error", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
