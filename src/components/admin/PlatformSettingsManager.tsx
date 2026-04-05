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
        placeholder: "Ayiti Market"
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
       </CardContent>
     </Card>
   );
 }