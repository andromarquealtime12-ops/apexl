import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  useRobotSettings, 
  useRobotLogs, 
  useUpdateRobotSetting, 
  useRunAdminRobot 
} from "@/hooks/useAdminRobot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, Play, Loader2, CheckCircle, XCircle, 
  AlertTriangle, Wallet, Shield, UserCheck, Car
} from "lucide-react";

const SETTING_LABELS: Record<string, { label: string; icon: any; description: string }> = {
  auto_approve_deposits: {
    label: "Dépôts automatiques",
    icon: Wallet,
    description: "Approuve automatiquement les dépôts avec preuve"
  },
  auto_verify_identity: {
    label: "Vérification identité",
    icon: Shield,
    description: "Vérifie automatiquement les documents d'identité"
  },
  auto_approve_sellers: {
    label: "Approbation vendeurs",
    icon: UserCheck,
    description: "Approuve automatiquement les candidatures vendeurs"
  },
  auto_approve_drivers: {
    label: "Approbation livreurs",
    icon: Car,
    description: "Approuve automatiquement les candidatures livreurs"
  },
  auto_suspend_suspicious: {
    label: "Suspension automatique",
    icon: AlertTriangle,
    description: "Suspend les comptes avec score de confiance très bas"
  }
};

const ACTION_LABELS: Record<string, string> = {
  deposit_approved: "Dépôt approuvé",
  identity_verified: "Identité vérifiée",
  seller_approved: "Vendeur approuvé",
  driver_approved: "Livreur approuvé",
  user_suspended: "Utilisateur suspendu"
};

export default function AdminRobotPanel() {
  const { data: settings, isLoading: settingsLoading } = useRobotSettings();
  const { data: logs, isLoading: logsLoading } = useRobotLogs(20);
  const updateSetting = useUpdateRobotSetting();
  const runRobot = useRunAdminRobot();
  const { toast } = useToast();
  const [maxAmount, setMaxAmount] = useState<string>("50000");

  const handleToggle = async (settingKey: string, currentEnabled: boolean) => {
    try {
      await updateSetting.mutateAsync({ settingKey, isEnabled: !currentEnabled });
      toast({
        title: !currentEnabled ? "Activé" : "Désactivé",
        description: `${SETTING_LABELS[settingKey]?.label || settingKey} est maintenant ${!currentEnabled ? "activé" : "désactivé"}`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRunRobot = async () => {
    try {
      const result = await runRobot.mutateAsync();
      toast({
        title: "Robot exécuté ✓",
        description: `${result.total} tâches traitées: ${result.deposits_processed} dépôts, ${result.identities_processed} identités, ${result.sellers_processed} vendeurs, ${result.drivers_processed} livreurs`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateMaxAmount = async () => {
    try {
      await updateSetting.mutateAsync({
        settingKey: "auto_approve_deposits",
        settingValue: { max_amount: parseInt(maxAmount), require_proof: true }
      });
      toast({
        title: "Limite mise à jour",
        description: `Montant maximum: ${parseInt(maxAmount).toLocaleString()} DOP`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (settingsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Robot Control */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Robot Admin Automatique
          </CardTitle>
          <CardDescription>
            Le robot traite automatiquement les tâches administratives en arrière-plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            onClick={handleRunRobot}
            disabled={runRobot.isPending}
            size="lg"
            className="w-full"
          >
            {runRobot.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Robot en cours d'exécution...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Exécuter le Robot Maintenant
              </>
            )}
          </Button>

          {/* Settings toggles */}
          <div className="grid gap-4">
            {settings?.map((setting) => {
              const config = SETTING_LABELS[setting.setting_key];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div 
                  key={setting.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${setting.is_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium">{config.label}</p>
                      <p className="text-sm text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={setting.is_enabled}
                    onCheckedChange={() => handleToggle(setting.setting_key, setting.is_enabled)}
                  />
                </div>
              );
            })}
          </div>

          {/* Max amount config */}
          <div className="p-4 rounded-lg border bg-card">
            <Label htmlFor="maxAmount">Montant max auto-approbation dépôts</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="maxAmount"
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="50000"
              />
              <Button onClick={handleUpdateMaxAmount} variant="outline">
                Mettre à jour
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Les dépôts supérieurs à ce montant nécessitent une validation manuelle
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Robot Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Historique du Robot
            <Badge variant="outline">{logs?.length || 0} actions</Badge>
          </CardTitle>
          <CardDescription>Dernières actions automatisées</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : logs && logs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : log.status === "skipped" ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.details?.amount && `${log.details.amount} ${log.details.currency || ''}`}
                      {log.details?.shop_name && log.details.shop_name}
                      {log.details?.vehicle && log.details.vehicle}
                      {log.details?.reason && log.details.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Aucune action automatisée pour le moment
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
