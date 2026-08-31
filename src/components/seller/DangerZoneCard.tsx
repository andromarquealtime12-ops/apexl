import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

type Kind = "shop" | "restaurant";

export default function DangerZoneCard({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isShop = kind === "shop";
  const keyword = isShop ? "SUPPRIMER" : "SUPPRIMER";

  const title = isShop
    ? t("dangerZone.shopTitle", "Supprimer ma boutique")
    : t("dangerZone.restaurantTitle", "Supprimer mon restaurant");
  const desc = isShop
    ? t("dangerZone.shopDesc", "Tous vos produits seront définitivement supprimés. Impossible si vous avez des commandes en cours.")
    : t("dangerZone.restaurantDesc", "Votre restaurant et tous ses plats seront définitivement supprimés. Impossible si vous avez des commandes en cours.");

  const handleDelete = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        isShop ? "delete_my_shop" : "delete_my_restaurant"
      );
      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        if (res?.error === "ACTIVE_ORDERS") {
          toast.error(t("dangerZone.activeOrders", "Impossible : vous avez encore des commandes en cours."));
        } else if (res?.error === "NO_RESTAURANT") {
          toast.error(t("dangerZone.noRestaurant", "Aucun restaurant à supprimer."));
        } else {
          toast.error(res?.error || "Error");
        }
        return;
      }
      toast.success(t("dangerZone.deleted", "Suppression effectuée."));
      queryClient.invalidateQueries();
      setOpen(false);
      setConfirmText("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive text-base">
          <AlertTriangle className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" /> {title}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{desc}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label>
                {t("dangerZone.typeConfirm", "Tapez {{word}} pour confirmer", { word: keyword })}
              </Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={keyword} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText.trim().toUpperCase() !== keyword || loading}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dangerZone.confirm", "Supprimer définitivement")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
