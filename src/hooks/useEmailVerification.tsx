import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useSendVerificationCode() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (targetEmail?: string) => {
      const email = (targetEmail && targetEmail.trim()) || user?.email;
      if (!email) throw new Error("No email provided");

      // After clicking the confirmation link, the user lands back on /profile
      // with ?verified=1 so we can display a success toast + refresh state.
      const emailRedirectTo = `${window.location.origin}/profile?verified=1`;

      // If the target email differs from the account email, trigger an email
      // change — Supabase sends the confirmation link to the NEW address.
      if (
        user?.email &&
        targetEmail &&
        targetEmail.trim().toLowerCase() !== user.email.toLowerCase()
      ) {
        const { error } = await supabase.auth.updateUser(
          { email: targetEmail.trim() },
          { emailRedirectTo }
        );
        if (error) throw error;
        return { email: targetEmail.trim(), mode: "change" as const };
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      return { email, mode: "resend" as const };
    },
    onSuccess: (res) => {
      toast.success(
        `Lien de vérification envoyé à ${res.email}. Vérifiez votre boîte de réception (et vos spams).`,
        { duration: 6000 }
      );
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erreur lors de l'envoi. Réessayez dans quelques minutes.");
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
