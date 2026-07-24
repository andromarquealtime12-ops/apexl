import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useSubmitDriverApplication, useMyDriverApplication } from "@/hooks/useApplications";
import { useIsEmailVerified } from "@/hooks/useProfile";
import { useSendVerificationCode } from "@/hooks/useEmailVerification";
import { Loader2, Truck, CheckCircle, Clock, Mail, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadApplicationDocument } from "@/utils/applicationUploads";

interface DriverApplicationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DriverApplicationForm({ isOpen, onClose }: DriverApplicationFormProps) {
  const { t } = useTranslation();
  const { data: existingApplication, isLoading: loadingApplication } = useMyDriverApplication();
  const submitApplication = useSubmitDriverApplication();
  const { isVerified: isEmailVerified } = useIsEmailVerified();
  const sendVerification = useSendVerificationCode();

  const [verifyEmail, setVerifyEmail] = useState("");
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

  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [vehicleReg, setVehicleReg] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isMoto = formData.vehicle_type === "motorcycle";
  const docsReady = !!(licenseFront && licenseBack && selfie && (!isMoto || vehicleReg));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicle_type) return;
    if (!docsReady) {
      toast.error(t("driverApp.docsMissing"));
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [frontUrl, backUrl, regUrl, selfieUrl] = await Promise.all([
        uploadApplicationDocument(user.id, "driver-license-front", licenseFront!),
        uploadApplicationDocument(user.id, "driver-license-back", licenseBack!),
        vehicleReg ? uploadApplicationDocument(user.id, "vehicle-registration", vehicleReg) : Promise.resolve(null),
        uploadApplicationDocument(user.id, "driver-selfie", selfie!),
      ]);

      await submitApplication.mutateAsync({
        ...formData,
        vehicle_type: formData.vehicle_type as "motorcycle" | "car" | "bicycle" | "truck",
        driver_license_front_url: frontUrl,
        driver_license_back_url: backUrl,
        vehicle_registration_url: regUrl,
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
              <Truck className="h-5 w-5" />
              {t("driverApp.statusTitle")}
            </DialogTitle>
          </DialogHeader>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {t(`driverApp.vt.${existingApplication.vehicle_type}`)} - {existingApplication.vehicle_brand}
              </CardTitle>
              <CardDescription>{existingApplication.city}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {existingApplication.status === "pending" && (
                  <>
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <span className="text-yellow-600 font-medium">{t("driverApp.pending")}</span>
                  </>
                )}
                {existingApplication.status === "approved" && (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">{t("driverApp.approvedMsg")}</span>
                  </>
                )}
                {existingApplication.status === "rejected" && (
                  <span className="text-red-600 font-medium">{t("driverApp.rejectedMsg")}</span>
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
            {t("driverApp.title")}
          </DialogTitle>
          <DialogDescription>{t("driverApp.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEmailVerified && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
              <Mail className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm space-y-2">
                <p>{t("driverApp.emailAlert")}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="you@email.com"
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
                    {sendVerification.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("driverApp.sendLink")}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="vehicle_type">{t("driverApp.vehicleType")} *</Label>
            <Select value={formData.vehicle_type} onValueChange={(value) => handleChange("vehicle_type", value)} required>
              <SelectTrigger><SelectValue placeholder={t("driverApp.selectType")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">{t("driverApp.vt.motorcycle")}</SelectItem>
                <SelectItem value="car">{t("driverApp.vt.car")}</SelectItem>
                <SelectItem value="bicycle">{t("driverApp.vt.bicycle")}</SelectItem>
                <SelectItem value="truck">{t("driverApp.vt.truck")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_brand">{t("driverApp.brand")} *</Label>
              <Input id="vehicle_brand" placeholder={t("driverApp.brandPlaceholder")} value={formData.vehicle_brand} onChange={(e) => handleChange("vehicle_brand", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_model">{t("driverApp.model")}</Label>
              <Input id="vehicle_model" placeholder={t("driverApp.modelPlaceholder")} value={formData.vehicle_model} onChange={(e) => handleChange("vehicle_model", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_year">{t("driverApp.year")}</Label>
              <Input id="vehicle_year" placeholder="2020" value={formData.vehicle_year} onChange={(e) => handleChange("vehicle_year", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_plate">{t("driverApp.plate")} *</Label>
              <Input id="license_plate" placeholder="AA-00000" value={formData.license_plate} onChange={(e) => handleChange("license_plate", e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="driver_license_number">{t("driverApp.licenseNum")} *</Label>
            <Input id="driver_license_number" placeholder={t("driverApp.licensePlaceholder")} value={formData.driver_license_number} onChange={(e) => handleChange("driver_license_number", e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("driverApp.phone")} *</Label>
              <Input id="phone" type="tel" placeholder="+509 00 00 0000" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("driverApp.city")} *</Label>
              <Select value={formData.city} onValueChange={(value) => handleChange("city", value)} required>
                <SelectTrigger><SelectValue placeholder={t("driverApp.city")} /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__do" disabled>🇩🇴 República Dominicana</SelectItem>
                  {ALL_CITIES.DO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__ht" disabled>🇭🇹 Haïti</SelectItem>
                  {ALL_CITIES.HT.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="availability">{t("driverApp.availability")}</Label>
            <Textarea id="availability" placeholder={t("driverApp.availPlaceholder")} value={formData.availability} onChange={(e) => handleChange("availability", e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> {t("driverApp.docs")}
            </p>
            <p className="text-xs text-muted-foreground">{t("driverApp.docsHint")}</p>

            <div className="grid gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("driverApp.licFront")} *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setLicenseFront(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("driverApp.licBack")} *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setLicenseBack(e.target.files?.[0] || null)} />
              </div>
              {isMoto && (
                <div className="space-y-1">
                  <Label className="text-xs">{t("driverApp.vehReg")} *</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setVehicleReg(e.target.files?.[0] || null)} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">{t("driverApp.selfie")} *</Label>
                <Input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitApplication.isPending || uploading || !formData.vehicle_type || !docsReady}>
            {(submitApplication.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {uploading ? t("driverApp.submitting") : t("driverApp.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
