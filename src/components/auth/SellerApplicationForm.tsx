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
import { Loader2, Store, CheckCircle, Clock, MapPin, Navigation } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SellerApplicationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SellerApplicationForm({ isOpen, onClose }: SellerApplicationFormProps) {
  const { data: existingApplication, isLoading: loadingApplication } = useMySellerApplication();
  const submitApplication = useSubmitSellerApplication();
  
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
    await submitApplication.mutateAsync({
      ...formData,
      latitude: shopLat,
      longitude: shopLng,
    });
    onClose();
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
            <Label htmlFor="shop_address">Adresse *</Label>
            <Input id="shop_address" placeholder="123 Rue du Commerce" value={formData.shop_address} onChange={(e) => handleChange("shop_address", e.target.value)} required />
          </div>

          {/* GPS Location */}
          <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> Localisation de la boutique
                </p>
                {shopLat && shopLng ? (
                  <p className="text-xs text-green-600">Position enregistrée ✓</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Permet aux livreurs de vous trouver</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={gettingLocation}>
                {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                <span className="ml-1">{shopLat ? "Actualiser" : "Ma position"}</span>
              </Button>
            </div>
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

          <Button type="submit" className="w-full" disabled={submitApplication.isPending}>
            {submitApplication.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Soumettre ma demande
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}