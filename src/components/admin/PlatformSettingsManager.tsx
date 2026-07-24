 import { useState, useEffect } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Settings, Save, DollarSign, Percent, MapPin, Gift } from "lucide-react";
 import { usePlatformSettings, useUpdatePlatformSetting } from "@/hooks/useAdminAdvanced";
 import { useToast } from "@/hooks/use-toast";
 
 export default function PlatformSettingsManager() {
   const { data: settings, isLoading } = usePlatformSettings();
   const updateSetting = useUpdatePlatformSetting();
   const { toast } = useToast();
 
   const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
 
   useEffect(() => {
     if (settings) {
       setLocalSettings(settings);
     }
   }, [settings]);
 
   const handleSave = async (key: string) => {
     try {
       await updateSetting.mutateAsync({ key, value: localSettings[key] });
       toast({ title: "Paramètre sauvegardé" });
     } catch (error) {
       toast({ title: "Erreur", variant: "destructive" });
     }
   };
 
   if (isLoading) {
     return <Skeleton className="h-64 w-full" />;
   }
 
    const settingsConfig = [
      {
        key: "identity_verification_threshold",
        label: "Seuil de vérification d'identité",
        description: "Montant en RD$ à partir duquel la vérification est requise",
        icon: DollarSign,
        suffix: "RD$"
      },
      {
        key: "platform_commission_percent",
        label: "Commission plateforme",
        description: "Pourcentage prélevé sur chaque vente",
        icon: Percent,
        suffix: "%"
      },
      {
        key: "delivery_base_fee",
        label: "Frais de livraison de base",
        description: "Montant minimum pour une livraison",
        icon: MapPin,
        suffix: "RD$"
      },
      {
        key: "referral_reward_percent",
        label: "Récompense parrainage",
        description: "Pourcentage de récompense sur les 3 premières commandes du filleul",
        icon: Gift,
        suffix: "%"
      },
      {
        key: "conversion_commission_percent",
        label: "Commission conversion",
        description: "Pourcentage prélevé automatiquement lors des conversions de devises",
        icon: Percent,
        suffix: "%"
      },
      {
        key: "cash_commission_percent",
        label: "Commission paiement cash",
        description: "Pourcentage prélevé sur les vendeurs pour les paiements en espèces",
        icon: Percent,
        suffix: "%"
      },
    ];

    const textSettingsConfig = [
      {
        key: "wise_email",
        label: "Email Wise",
        description: "Adresse email pour recevoir les dépôts Wise",
        icon: DollarSign,
        placeholder: "votre@email.com"
      },
      {
        key: "wise_account_name",
        label: "Nom du compte Wise",
        description: "Nom affiché pour le bénéficiaire Wise",
        icon: DollarSign,
        placeholder: "Mantalite Kominote"
      },
      {
        key: "banreservas_account",
        label: "Numéro compte Banreservas",
        description: "Numéro de compte Banreservas pour les dépôts",
        icon: DollarSign,
        placeholder: "9607842951"
      },
      {
        key: "moncash_number",
        label: "Numéro Moncash",
        description: "Numéro Moncash pour les dépôts",
        icon: DollarSign,
        placeholder: "39297720"
      },
      {
        key: "bhd_account",
        label: "Numéro compte BHD León",
        description: "Numéro de compte BHD León pour les dépôts",
        icon: DollarSign,
        placeholder: "Numéro de compte"
      },
      {
        key: "popular_account",
        label: "Numéro compte Banco Popular",
        description: "Numéro de compte Banco Popular pour les dépôts",
        icon: DollarSign,
        placeholder: "Numéro de compte"
      },
      {
        key: "orange_money_number",
        label: "Numéro Orange Money",
        description: "Numéro Orange Money pour les dépôts",
        icon: DollarSign,
        placeholder: "Numéro"
      },
      {
        key: "paypal_email",
        label: "Email PayPal",
        description: "Adresse email PayPal pour recevoir les paiements",
        icon: DollarSign,
        placeholder: "payments@example.com"
      },
      {
        key: "bank_transfer_do_details",
        label: "Détails virement RD",
        description: "Coordonnées pour virements bancaires en République Dominicaine",
        icon: DollarSign,
        placeholder: "Nom de banque, numéro de compte..."
      },
      {
        key: "bank_transfer_ht_details",
        label: "Détails virement Haïti",
        description: "Coordonnées pour virements bancaires en Haïti",
        icon: DollarSign,
        placeholder: "Nom de banque, numéro de compte..."
      },
    ];
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Settings className="h-5 w-5" />
           Paramètres de la plateforme
         </CardTitle>
         <CardDescription>Configurez les options globales du marketplace</CardDescription>
       </CardHeader>
       <CardContent className="space-y-6">
         {settingsConfig.map((config) => (
           <div key={config.key} className="flex items-end gap-4">
             <div className="flex-1 space-y-2">
               <Label className="flex items-center gap-2">
                 <config.icon className="h-4 w-4" />
                 {config.label}
               </Label>
               <p className="text-xs text-muted-foreground">{config.description}</p>
               <div className="flex items-center gap-2">
                 <Input
                   type="number"
                   value={localSettings[config.key] || ""}
                   onChange={(e) => setLocalSettings(s => ({ ...s, [config.key]: e.target.value }))}
                   className="max-w-[200px]"
                 />
                 <span className="text-muted-foreground">{config.suffix}</span>
               </div>
             </div>
             <Button 
               variant="outline" 
               size="sm"
               onClick={() => handleSave(config.key)}
               disabled={localSettings[config.key] === settings?.[config.key]}
             >
               <Save className="h-4 w-4 mr-1" />
               Sauvegarder
             </Button>
            </div>
          ))}

          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comptes de dépôt
            </h3>
            {textSettingsConfig.map((config) => (
              <div key={config.key} className="flex items-end gap-4 mb-4">
                <div className="flex-1 space-y-2">
                  <Label className="flex items-center gap-2">
                    <config.icon className="h-4 w-4" />
                    {config.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                  <Input
                    type="text"
                    placeholder={config.placeholder}
                    value={localSettings[config.key] || ""}
                    onChange={(e) => setLocalSettings(s => ({ ...s, [config.key]: e.target.value }))}
                    className="max-w-[300px]"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSave(config.key)}
                  disabled={localSettings[config.key] === settings?.[config.key]}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Sauvegarder
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }