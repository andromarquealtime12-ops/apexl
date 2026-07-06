import { useState } from "react";
import { ALL_CITIES } from "@/utils/cities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubmitDriverApplication, useMyDriverApplication } from "@/hooks/useApplications";
import { useIsEmailVerified } from "@/hooks/useProfile";
import { Loader2, Truck, CheckCircle, Clock, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface DriverApplicationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const VEHICLE_TYPES = {
  motorcycle: "Moto",
  car: "Voiture",
  bicycle: "Vélo",
  truck: "Camion",
};

export function DriverApplicationForm({ isOpen, onClose }: DriverApplicationFormProps) {
  const { data: existingApplication, isLoading: loadingApplication } = useMyDriverApplication();
  const submitApplication = useSubmitDriverApplication();
  const { isVerified: isEmailVerified } = useIsEmailVerified();
  
  const [formData, setFormData] = useState({
    vehicle_type: "" as "motorcycle" | "car" | "bicycle" | "truck" | "",
    vehicle_brand: "",
    vehicle_model: "",
    vehicle_year: "",
    license_plate: "",
    driver_license_number: "",
    phone: "",
    city: "",
    availability: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_type) return;
    if (!isEmailVerified) {
      toast.error("Veuillez vérifier votre email avant de soumettre une demande livreur.");
      return;
    }

    await submitApplication.mutateAsync({
      ...formData,
      vehicle_type: formData.vehicle_type as "motorcycle" | "car" | "bicycle" | "truck",
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

  // Show existing application status
  if (existingApplication) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Statut de votre demande
            </DialogTitle>
          </DialogHeader>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {VEHICLE_TYPES[existingApplication.vehicle_type]} - {existingApplication.vehicle_brand}
              </CardTitle>
              <CardDescription>{existingApplication.city}</CardDescription>
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
                    <span className="text-green-600 font-medium">Approuvée ! Vous êtes maintenant livreur</span>
                  </>
                )}
                {existingApplication.status === "rejected" && (
                  <>
                    <span className="text-red-600 font-medium">Demande rejetée</span>
                  </>
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
            <Truck className="h-5 w-5" />
            Devenir Livreur
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations de votre véhicule pour commencer à livrer
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle_type">Type de véhicule *</Label>
            <Select
              value={formData.vehicle_type}
              onValueChange={(value) => handleChange("vehicle_type", value)}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez le type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">Moto</SelectItem>
                <SelectItem value="car">Voiture</SelectItem>
                <SelectItem value="bicycle">Vélo</SelectItem>
                <SelectItem value="truck">Camion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_brand">Marque *</Label>
              <Input
                id="vehicle_brand"
                placeholder="Toyota, Honda..."
                value={formData.vehicle_brand}
                onChange={(e) => handleChange("vehicle_brand", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_model">Modèle</Label>
              <Input
                id="vehicle_model"
                placeholder="Corolla, Civic..."
                value={formData.vehicle_model}
                onChange={(e) => handleChange("vehicle_model", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_year">Année</Label>
              <Input
                id="vehicle_year"
                placeholder="2020"
                value={formData.vehicle_year}
                onChange={(e) => handleChange("vehicle_year", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="license_plate">Plaque d'immatriculation *</Label>
              <Input
                id="license_plate"
                placeholder="AA-00000"
                value={formData.license_plate}
                onChange={(e) => handleChange("license_plate", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver_license_number">Numéro de permis *</Label>
            <Input
              id="driver_license_number"
              placeholder="Votre numéro de permis de conduire"
              value={formData.driver_license_number}
              onChange={(e) => handleChange("driver_license_number", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+509 00 00 0000"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Ville *</Label>
              <Select
                value={formData.city}
                onValueChange={(value) => handleChange("city", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ville" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__do" disabled>🇩🇴 République Dominicaine</SelectItem>
                  {ALL_CITIES.DO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__ht" disabled>🇭🇹 Haïti</SelectItem>
                  {ALL_CITIES.HT.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">Disponibilité</Label>
            <Textarea
              id="availability"
              placeholder="Ex: Lundi-Vendredi 8h-18h, Week-ends disponible..."
              value={formData.availability}
              onChange={(e) => handleChange("availability", e.target.value)}
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitApplication.isPending || !formData.vehicle_type}
          >
            {submitApplication.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Soumettre ma demande
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
