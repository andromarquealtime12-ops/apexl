import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function IdentityVerificationForm() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const submitVerification = useMutation({
    mutationFn: async () => {
      if (!user || !idFront || !idBack || !selfie) throw new Error("Missing files");

      const uploadFile = async (file: File, type: string) => {
        const fileName = `${user.id}/${type}-${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage
          .from("identity-documents")
          .upload(fileName, file);
        if (error) throw error;

        // Bucket is private: store the object path, signed URLs are made on display.
        return fileName;
      };


      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadFile(idFront, "id-front"),
        uploadFile(idBack, "id-back"),
        uploadFile(selfie, "selfie")
      ]);

      // Call the edge function for AI-powered verification
      const { data, error } = await supabase.functions.invoke("identity-verify", {
        body: {
          action: "submit",
          document_front_url: frontUrl,
          document_back_url: backUrl,
          selfie_url: selfieUrl,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const isAutoVerified = data?.ai_analysis?.verified;
      toast({ 
        title: isAutoVerified ? "Identité vérifiée ✓" : "Demande envoyée ✓", 
        description: isAutoVerified 
          ? "Votre identité a été vérifiée automatiquement par notre IA." 
          : "Votre demande sera examinée sous 24-48h." 
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setIdFront(null);
      setIdBack(null);
      setSelfie(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'envoyer la demande", variant: "destructive" });
    }
  });

  const identityStatus = (profile as any)?.identity_status || "unverified";

  const getStatusDisplay = () => {
    switch (identityStatus) {
      case "verified":
        return (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">
              Votre identité est vérifiée. Vous bénéficiez de tous les avantages de la plateforme.
            </AlertDescription>
          </Alert>
        );
      case "pending":
        return (
          <Alert className="border-yellow-500 bg-yellow-50">
            <Clock className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-700">
              Votre demande est en cours d'examen. Délai estimé : 24-48h.
            </AlertDescription>
          </Alert>
        );
      case "rejected":
        return (
          <Alert className="border-red-500 bg-red-50">
            <XCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">
              Votre demande a été refusée. Veuillez soumettre de nouveaux documents.
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  if (identityStatus === "verified") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Identité vérifiée
            <Badge className="bg-green-500">✓ Vérifié</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>{getStatusDisplay()}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Vérification d'identité
          {identityStatus === "pending" && <Badge className="bg-yellow-500">En attente</Badge>}
          {identityStatus === "rejected" && <Badge variant="destructive">Refusée</Badge>}
        </CardTitle>
        <CardDescription>
          Vérifiez votre identité pour augmenter votre score de confiance et accéder à toutes les fonctionnalités
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {getStatusDisplay()}

        {identityStatus !== "pending" && (
          <>
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertDescription>
                Vérification IA automatique disponible — résultat en quelques secondes si les documents sont clairs
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                La vérification est requise pour les transactions supérieures à 10,000 RD$
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              <div>
                <Label>Pièce d'identité (Recto)</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Input type="file" accept="image/*" onChange={(e) => setIdFront(e.target.files?.[0] || null)} />
                  {idFront && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
              </div>

              <div>
                <Label>Pièce d'identité (Verso)</Label>
                <div className="mt-2 flex items-center gap-4">
                  <Input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files?.[0] || null)} />
                  {idBack && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
              </div>

              <div>
                <Label>Selfie avec votre pièce d'identité</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Prenez une photo de vous tenant votre pièce d'identité à côté de votre visage
                </p>
                <div className="flex items-center gap-4">
                  <Input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
                  {selfie && <CheckCircle className="h-5 w-5 text-green-500" />}
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => submitVerification.mutate()}
              disabled={!idFront || !idBack || !selfie || submitVerification.isPending}
            >
              {submitVerification.isPending ? (
                "Analyse IA en cours..."
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Soumettre pour vérification IA
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
