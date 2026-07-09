import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Loader2, Mail } from "lucide-react";

/**
 * Sensitive personal info edit card.
 * - Email change → uses Supabase built-in confirmation link (native).
 * - Name / phone change:
 *    - Buyers: saved directly.
 *    - Sellers / Drivers: require a 6-digit code sent to the current email
 *      (proof of identity) before the update is applied.
 */
export default function SensitiveInfoCard() {
  const { user, isSeller, isDriver } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const needsVerification = isSeller || isDriver;

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [newEmail, setNewEmail] = useState(user?.email ?? "");

  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const requestCode = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Email introuvable");
      // Send a 6-digit OTP to the current verified email (proof of identity)
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCodeSent(true);
      toast.success("Code envoyé à votre email — vérifiez votre boîte de réception");
    },
    onError: (e: any) => toast.error(e.message || "Envoi impossible"),
  });

  const saveNameOrPhone = async () => {
    if (!user) return;
    const changed =
      fullName.trim() !== (profile?.full_name ?? "") ||
      (phone.trim() || null) !== (profile?.phone ?? null);
    if (!changed) {
      toast.info("Aucune modification");
      return;
    }

    try {
      setSavingProfile(true);
      if (needsVerification) {
        if (!code || code.length < 6) {
          toast.error("Entrez le code reçu par email");
          return;
        }
        // Verify reauth OTP — this proves identity via email
        const { error } = await supabase.auth.verifyOtp({
          email: user.email!,
          token: code,
          type: "email",
        });
        if (error) throw error;
      }

      await updateProfile.mutateAsync({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      } as any);

      setCode("");
      setCodeSent(false);
      toast.success("Informations mises à jour ✓");
    } catch (e: any) {
      toast.error(e.message || "Échec de la mise à jour");
    } finally {
      setSavingProfile(false);
    }
  };

  const changeEmail = useMutation({
    mutationFn: async () => {
      if (!newEmail || newEmail === user?.email) throw new Error("Entrez un nouvel email");
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
    },
    onSuccess: () =>
      toast.success(
        "Lien de confirmation envoyé à votre nouvelle adresse. Cliquez dessus pour valider le changement.",
      ),
    onError: (e: any) => toast.error(e.message || "Impossible de changer l'email"),
  });

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Informations sensibles
        </CardTitle>
        <CardDescription>
          {needsVerification
            ? "En tant que vendeur/livreur, toute modification requiert une vérification par email."
            : "Modifiez votre nom, téléphone et email."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Name + phone */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="s_full_name">Nom complet</Label>
            <Input
              id="s_full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s_phone">Téléphone</Label>
            <Input
              id="s_phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+509 ..."
              maxLength={30}
            />
          </div>
        </div>

        {needsVerification && (
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" />
              Vérification obligatoire pour modifier le nom ou le téléphone.
            </p>
            {codeSent ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Code à 6 chiffres"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestCode.mutate()}
                  disabled={requestCode.isPending}
                >
                  Renvoyer
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => requestCode.mutate()}
                disabled={requestCode.isPending}
                className="gap-1"
              >
                {requestCode.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Envoyer le code de vérification
              </Button>
            )}
          </div>
        )}

        <Button
          onClick={saveNameOrPhone}
          disabled={savingProfile || updateProfile.isPending}
          className="w-full"
        >
          {savingProfile ? "Enregistrement..." : "Enregistrer nom & téléphone"}
        </Button>

        {/* Email change */}
        <div className="pt-4 border-t space-y-2">
          <Label htmlFor="s_email">Adresse email</Label>
          <div className="flex gap-2">
            <Input
              id="s_email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => changeEmail.mutate()}
              disabled={changeEmail.isPending || newEmail === user?.email}
            >
              {changeEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Changer"}
            </Button>
          </div>
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Un lien de confirmation sera envoyé à la nouvelle adresse. L'email n'est modifié qu'après clic sur ce lien.
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
