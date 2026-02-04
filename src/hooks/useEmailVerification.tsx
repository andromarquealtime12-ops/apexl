import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Generate a random 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function useSendVerificationCode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("No email found");

      const code = generateVerificationCode();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      // Save the code to the profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          verification_code: code,
          verification_code_expires_at: expiresAt.toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // In demo mode, we'll just show the code in a toast
      // In production, you'd send this via email using an edge function
      console.log("Verification code (DEMO):", code);
      
      return { code, email: user.email };
    },
    onSuccess: (data) => {
      // Demo mode: show the code directly
      toast.success(`Code de vérification envoyé !`);
      toast.info(`Code DEMO: ${data.code}`, { duration: 30000 });
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'envoi du code");
      console.error(error);
    },
  });
}

export function useVerifyEmailCode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputCode: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get the profile with the verification code
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("verification_code, verification_code_expires_at")
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw fetchError;
      if (!profile?.verification_code) throw new Error("No verification code found");

      // Check if code has expired
      if (profile.verification_code_expires_at) {
        const expiresAt = new Date(profile.verification_code_expires_at);
        if (expiresAt < new Date()) {
          throw new Error("Code expiré");
        }
      }

      // Verify the code
      if (profile.verification_code !== inputCode) {
        throw new Error("Code invalide");
      }

      // Mark email as verified
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          email_verified: true,
          verification_code: null,
          verification_code_expires_at: null,
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Email vérifié avec succès !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Code invalide");
    },
  });
}
