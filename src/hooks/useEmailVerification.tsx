import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useSendVerificationCode() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("No email found");

      // Use Supabase Auth's built-in email resend
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });

      if (error) throw error;
      
      return { email: user.email };
    },
    onSuccess: () => {
      toast.success("Email de vérification envoyé ! Vérifiez votre boîte de réception.");
    },
    onError: (error: any) => {
      toast.error("Erreur lors de l'envoi. Réessayez dans quelques minutes.");
      console.error(error);
    },
  });
}

export function useVerifyEmailCode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputCode: string) => {
      if (!user?.email) throw new Error("Not authenticated");

      // Use Supabase Auth OTP verification
      const { error } = await supabase.auth.verifyOtp({
        email: user.email,
        token: inputCode,
        type: "email",
      });

      if (error) throw error;

      // Also mark in profile for app-level checks
      await supabase
        .from("profiles")
        .update({
          email_verified: true,
          verification_code: null,
          verification_code_expires_at: null,
        })
        .eq("user_id", user.id);

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Email vérifié avec succès !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Code invalide ou expiré");
    },
  });
}
