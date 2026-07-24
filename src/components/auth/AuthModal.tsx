import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Store, Truck, KeyRound } from "lucide-react";
import { z } from "zod";
import { SellerApplicationForm } from "./SellerApplicationForm";
import { DriverApplicationForm } from "./DriverApplicationForm";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Le nom doit avoir au moins 2 caractères").max(100),
  email: z.string().email("Email invalide").max(255),
  password: z.string().min(6, "Le mot de passe doit avoir au moins 6 caractères").max(72),
});

const signInSchema = z.object({
  email: z.string().email("Email invalide").max(255),
  password: z.string().min(1, "Mot de passe requis").max(72),
});

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup";
}

export function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { t } = useTranslation();
  const { signIn, signUp, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = signInSchema.safeParse({ 
      email: signInEmail, 
      password: signInPassword 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setLoading(true);
    const { error } = await signIn(signInEmail, signInPassword);
    
    if (error) {
      setLoading(false);
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("invalid login credentials")) {
        toast.error("Email ou mot de passe incorrect. Vérifiez vos identifiants.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Votre email n'est pas encore vérifié. Vérifiez votre boîte de réception.");
      } else if (msg.includes("too many requests")) {
        toast.error("Trop de tentatives. Réessayez dans quelques minutes.");
      } else {
        toast.error("Échec de la connexion : " + (error.message || "Erreur inconnue"));
      }
      return;
    }
    
    toast.success(t("auth.signInSuccess"));
    setLoading(false);
    onClose();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = signUpSchema.safeParse({ 
      fullName: signUpName,
      email: signUpEmail, 
      password: signUpPassword 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setLoading(true);
    const { error } = await signUp(signUpEmail, signUpPassword, signUpName);
    setLoading(false);
    
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already registered")) {
        toast.error("Cette adresse email est déjà inscrite. Connectez-vous ou utilisez une autre adresse.");
      } else if (msg.includes("password") && msg.includes("least")) {
        toast.error("Le mot de passe doit avoir au moins 6 caractères.");
      } else {
        toast.error("Échec de l'inscription : " + (error.message || "Essayez avec un autre email."));
      }
    } else {
      toast.success(t("auth.signUpSuccess"));
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">{t("auth.title")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("auth.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.signin")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t("auth.email")}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@email.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground hover:text-primary p-0 h-auto"
                  onClick={() => setShowForgotPassword(true)}
                >
                  <KeyRound className="h-3 w-3 mr-1" />
                  {t("auth.forgot")}
                </Button>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signInBtn")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t("auth.fullName")}</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t("auth.namePlaceholder")}
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t("auth.email")}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@email.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.signUpBtn")}
                </Button>
                
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    {t("auth.sellOrDeliver")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!user) {
                          toast.error(t("auth.createFirst"));
                          return;
                        }
                        setShowSellerForm(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Store className="h-4 w-4" />
                      {t("auth.seller")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!user) {
                          toast.error(t("auth.createFirst"));
                          return;
                        }
                        setShowDriverForm(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Truck className="h-4 w-4" />
                      {t("auth.driver")}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
        
        <SellerApplicationForm 
          isOpen={showSellerForm} 
          onClose={() => setShowSellerForm(false)} 
        />
        
        <DriverApplicationForm 
          isOpen={showDriverForm} 
          onClose={() => setShowDriverForm(false)} 
        />
      </Dialog>
      
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
}
