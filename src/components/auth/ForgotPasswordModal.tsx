import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, CheckCircle } from "lucide-react";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<"email" | "code" | "newPassword" | "success">("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayedCode, setDisplayedCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Entrez votre email");
      return;
    }
    
    setLoading(true);
    
    // Vérifier si l'utilisateur existe
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(1);
    
    // En mode démo, on génère et affiche le code directement
    const generatedCode = generateCode();
    setDisplayedCode(generatedCode);
    
    // Sauvegarder le code dans le profil (si l'utilisateur existe)
    await supabase
      .from("profiles")
      .update({
        verification_code: generatedCode,
        verification_code_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "");
    
    setLoading(false);
    setStep("code");
    toast.success("Code de récupération généré !");
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code !== displayedCode) {
      toast.error("Code incorrect");
      return;
    }
    
    setStep("newPassword");
    toast.success("Code vérifié !");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit avoir au moins 6 caractères");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    setLoading(false);
    
    if (error) {
      toast.error("Erreur lors de la réinitialisation. Reconnectez-vous d'abord.");
      return;
    }
    
    setStep("success");
    toast.success("Mot de passe modifié avec succès !");
  };

  const handleClose = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setDisplayedCode("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-xl text-center flex items-center justify-center gap-2">
            <KeyRound className="h-5 w-5" />
            Récupération de compte
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "email" && "Entrez votre email pour recevoir un code"}
            {step === "code" && "Entrez le code de vérification"}
            {step === "newPassword" && "Créez un nouveau mot de passe"}
            {step === "success" && "Votre mot de passe a été réinitialisé"}
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <form onSubmit={handleSendCode} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer le code"}
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4 mt-4">
            {/* Affichage du code en mode démo */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                📧 Mode démo - Votre code de récupération :
              </p>
              <p className="text-3xl font-mono font-bold text-primary tracking-widest">
                {displayedCode}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copiez ce code ci-dessous
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Code de vérification</Label>
              <Input
                id="recovery-code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-xl tracking-widest"
                maxLength={6}
                required
              />
            </div>
            
            <Button type="submit" className="w-full">
              Vérifier le code
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full"
              onClick={() => setStep("email")}
            >
              Retour
            </Button>
          </form>
        )}

        {step === "newPassword" && (
          <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Réinitialiser"}
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="text-center py-6 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Mot de passe réinitialisé !</p>
              <p className="text-sm text-muted-foreground">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
