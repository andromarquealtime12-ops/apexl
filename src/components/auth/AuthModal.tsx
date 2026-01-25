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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Shield } from "lucide-react";
import { z } from "zod";

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
  const { signIn, signUp, validateAdminCode, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  
  // Form states
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
    setLoading(false);
    
    if (error) {
      toast.error("Échec de la connexion. Vérifiez vos identifiants.");
    } else {
      toast.success("Connexion réussie !");
      onClose();
    }
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
      toast.error("Échec de l'inscription. Essayez avec un autre email.");
    } else {
      toast.success("Compte créé avec succès !");
      onClose();
    }
  };

  const handleAdminCode = async () => {
    if (!adminCode.trim()) {
      toast.error("Entrez un code admin");
      return;
    }
    
    setLoading(true);
    const success = await validateAdminCode(adminCode.trim());
    setLoading(false);
    
    if (success) {
      toast.success("Accès admin activé !");
      setAdminCode("");
      setShowAdminCode(false);
    } else {
      toast.error("Code invalide ou expiré");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Ayiti Market</DialogTitle>
          <DialogDescription className="text-center">
            Connectez-vous pour accéder à votre compte
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 mt-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signin-password">Mot de passe</Label>
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
              </Button>
            </form>

            {user && (
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowAdminCode(!showAdminCode)}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Code d'accès spécial
                </Button>
                
                {showAdminCode && (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="Entrez le code admin..."
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                    />
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={handleAdminCode}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nom complet</Label>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Jean Pierre"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Mot de passe</Label>
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

              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
