import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Timing-safe string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const diditApiKey = Deno.env.get("DIDIT_API_KEY");
    const diditWebhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET");

    const body = await req.json();
    const { action, verification_id, document_front_url, document_back_url, selfie_url } = body;

    // ------------------------------------------------------------------
    // Webhook action: Didit -> our endpoint. Authenticate via shared secret.
    // NEVER trust user JWT here.
    // ------------------------------------------------------------------
    if (action === "webhook") {
      if (!diditWebhookSecret) {
        console.error("DIDIT_WEBHOOK_SECRET not configured; rejecting webhook call");
        return new Response(JSON.stringify({ error: "Webhook not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const providedSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-didit-signature") ||
        "";
      if (!providedSecret || !safeEqual(providedSecret, diditWebhookSecret)) {
        return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(supabaseUrl, serviceRoleKey);
      const vid: string | undefined = body.verification_id;
      const status: string | undefined = body.status;
      const details = body.details;

      if (!vid || !status) {
        return new Response(JSON.stringify({ error: "Missing verification_id or status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newStatus = status === "approved" ? "approved" : "rejected";

      await admin
        .from("identity_verifications")
        .update({
          status: newStatus,
          admin_comment: `Didit: ${details || status}`,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vid);

      const { data: ver } = await admin
        .from("identity_verifications")
        .select("user_id")
        .eq("id", vid)
        .single();

      if (ver) {
        await admin
          .from("profiles")
          .update({
            identity_status: newStatus === "approved" ? "verified" : "rejected",
            ...(newStatus === "approved" ? { trust_score: 80 } : {}),
          })
          .eq("user_id", ver.user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // All other actions require an authenticated user JWT.
    // ------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // Action: Submit verification with optional Didit AI analysis
    if (action === "submit") {
      const { data: verification, error: insertError } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: userId,
          id_document_front: document_front_url,
          id_document_back: document_back_url,
          selfie_photo: selfie_url,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase
        .from("profiles")
        .update({ identity_status: "pending" })
        .eq("user_id", userId);

      let aiAnalysis = null;
      if (diditApiKey) {
        try {
          const diditResponse = await fetch("https://apx.didit.me/v2/verify/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${diditApiKey}`,
            },
            body: JSON.stringify({
              document_front: document_front_url,
              document_back: document_back_url,
              selfie: selfie_url,
              callback_url: `${supabaseUrl}/functions/v1/identity-verify`,
            }),
          });

          if (diditResponse.ok) {
            aiAnalysis = await diditResponse.json();

            if (aiAnalysis?.status === "approved" || aiAnalysis?.verified === true) {
              await supabase
                .from("identity_verifications")
                .update({
                  status: "approved",
                  admin_comment: "Auto-vérifié par Didit AI",
                  reviewed_at: new Date().toISOString(),
                })
                .eq("id", verification.id);

              await supabase
                .from("profiles")
                .update({ identity_status: "verified", trust_score: 80 })
                .eq("user_id", userId);

              await supabase.from("notifications").insert({
                user_id: userId,
                title: "Identité vérifiée ✓",
                message: "Votre identité a été vérifiée automatiquement par notre système IA.",
                type: "success",
              });
            }
          }
        } catch (diditErr) {
          console.error("Didit API error:", diditErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          verification_id: verification.id,
          ai_analysis: aiAnalysis,
          message: aiAnalysis?.verified
            ? "Identité vérifiée automatiquement"
            : "Demande soumise, en attente de vérification",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: Check status
    if (action === "status") {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, verification: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
