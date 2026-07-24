import { useState, useCallback } from "react";
import { ALL_CITIES } from "@/utils/cities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useSubmitSellerApplication, useMySellerApplication } from "@/hooks/useApplications";
import { useIsEmailVerified } from "@/hooks/useProfile";
import { useSendVerificationCode } from "@/hooks/useEmailVerification";
import { Loader2, Store, CheckCircle, Clock, MapPin, Navigation, Mail, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { GpsAddressField } from "@/components/ui/GpsAddressField";
import { supabase } from "@/integrations/supabase/client";
import { uploadApplicationDocument } from "@/utils/applicationUploads";


interface SellerApplicationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SellerApplicationForm({ isOpen, onClose }: SellerApplicationFormProps) {
  const { data: existingApplication, isLoading: loadingApplication } = useMySellerApplication();
  const submitApplication = useSubmitSellerApplication();
  const { isVerified: isEmailVerified } = useIsEmailVerified();
  const sendVerification = useSendVerificationCode();
  
  const [formData, setFormData] = useState({
    shop_name: "",
    shop_description: "",
    shop_address: "",
    shop_city: "",
    shop_phone: "",
    business_type: "",
  });

  const [shopLat, setShopLat] = useState<number | null>(null);
  const [shopLng, setShopLng] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const docsReady = !!(idFront && idBack && selfie);

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non supportée");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setShopLat(pos.coords.latitude);
        setShopLng(pos.coords.longitude);
        setGettingLocation(false);
        toast.success("Position de la boutique enregistrée ✓");
      },
      () => {
        setGettingLocation(false);
        toast.error("Impossible d'obtenir la position");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docsReady) {
      toast.error("Veuillez joindre votre pièce d'identité (recto/verso) et un selfie.");
      return;
    }
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const [frontUrl, backUrl, selfieUrl] = await Promise.all([
        uploadApplicationDocument(user.id, "seller-id-front", idFront!),
        uploadApplicationDocument(user.id, "seller-id-back", idBack!),
        uploadApplicationDocument(user.id, "seller-selfie", selfie!),
      ]);
      await submitApplication.mutateAsync({
        ...formData,
        latitude: shopLat,
        longitude: shopLng,
        id_document_front_url: frontUrl,
        id_document_back_url: backUrl,
        selfie_url: selfieUrl,
      });
      onClose();
    } finally {
      setUploading(false);
    }
  };


  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loadingApplication) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (existingApplication) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Statut de votre demande
            </DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{existingApplication.shop_name}</CardTitle>
              <CardDescription>{existingApplication.shop_city}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {existingApplication.status === "pending" && (
                  <>
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <span className="text-yellow-600 font-medium">En attente de validation</span>
                  </>
                )}
                {existingApplication.status === "approved" && (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">Approuvée ! Vous êtes maintenant vendeur</span>
                  </>
                )}
                {existingApplication.status === "rejected" && (
                  <span className="text-red-600 font-medium">Demande rejetée</span>
                )}
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Devenir Vendeur
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations de votre boutique pour commencer à vendre
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEmailVerified && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
              <Mail className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm space-y-2">
                <p>Vérifiez votre email pour renforcer la confiance de votre boutique. Le lien sera envoyé à l'adresse ci-dessous.</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="votre@email.com"
                    value={verifyEmail}
                    onChange={(e) => setVerifyEmail(e.target.value)}
                    className="h-8 text-sm bg-background"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => sendVerification.mutate(verifyEmail || undefined)}
                    disabled={sendVerification.isPending}
                  >
                    {sendVerification.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Envoyer le lien"}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="shop_name">Nom de la boutique *</Label>
            <Input id="shop_name" placeholder="Ma Super Boutique" value={formData.shop_name} onChange={(e) => handleChange("shop_name", e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_type">Type de commerce</Label>
            <Select value={formData.business_type} onValueChange={(value) => handleChange("business_type", value)}>
              <SelectTrigger><SelectValue placeholder="Sélectionnez le type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="food">Alimentation</SelectItem>
                <SelectItem value="electronics">Électronique</SelectItem>
                <SelectItem value="clothing">Vêtements</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="beauty">Beauté & Santé</SelectItem>
                <SelectItem value="home">Maison & Jardin</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop_description">Description</Label>
            <Textarea id="shop_description" placeholder="Décrivez votre boutique..." value={formData.shop_description} onChange={(e) => handleChange("shop_description", e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shop_address">Adresse exacte de la boutique *</Label>
            <GpsAddressField
              id="shop_address"
              value={formData.shop_address}
              onChange={(v) => handleChange("shop_address", v)}
              coords={{ lat: shopLat, lng: shopLng }}
              onCoords={(la, lo) => {
                setShopLat(la);
                setShopLng(lo);
              }}
              onSelect={(s) => {
                handleChange("shop_address", s.address);
                if (s.city) handleChange("shop_city", s.city);
              }}
              placeholder="Ex: Calle El Conde 100, Zona Colonial…"
            />
            <p className="text-[11px] text-muted-foreground">
              Utilisez « Ma position » depuis la boutique pour des coordonnées exactes que les
              livreurs pourront suivre.
            </p>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shop_city">Ville *</Label>
              <Select value={formData.shop_city} onValueChange={(value) => handleChange("shop_city", value)} required>
                <SelectTrigger><SelectValue placeholder="Ville" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__do" disabled>🇩🇴 République Dominicaine</SelectItem>
                  {ALL_CITIES.DO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__ht" disabled>🇭🇹 Haïti</SelectItem>
                  {ALL_CITIES.HT.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop_phone">Téléphone *</Label>
              <Input id="shop_phone" type="tel" placeholder="+509 00 00 0000" value={formData.shop_phone} onChange={(e) => handleChange("shop_phone", e.target.value)} required />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> Vérification d'identité (obligatoire)
            </p>
            <p className="text-xs text-muted-foreground">
              CIN + selfie. Compte en mode limité tant que la vérification n'est pas approuvée.
            </p>
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pièce d'identité — recto *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setIdFront(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pièce d'identité — verso *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Selfie tenant votre pièce d'identité *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitApplication.isPending || uploading || !docsReady}>
            {(submitApplication.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {uploading ? "Envoi des documents…" : "Soumettre ma demande"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}