import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store, Search, MapPin, Package, Trash2, Loader2, Eye, Star, Wallet, TrendingUp } from "lucide-react";

function useAdminShops() {
  return useQuery({
    queryKey: ["admin-shops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((s: any) => s.user_id))];
      if (!ids.length) return [];
      const { data: products } = await supabase
        .from("products")
        .select("seller_id, is_active")
        .in("seller_id", ids);
      const counts: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        counts[p.seller_id] = (counts[p.seller_id] || 0) + 1;
      });
      return (data || []).map((s: any) => ({ ...s, product_count: counts[s.user_id] || 0 }));
    },
  });
}

function useShopOverview(userId: string | null) {
  return useQuery({
    queryKey: ["admin-shop-overview", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_shop_overview", { p_user_id: userId });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur");
      return data;
    },
  });
}

const fmt = (n: any) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function AdminShopsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<any>(null);
  const [confirmText, setConfirmText] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const { data: overview, isLoading: overviewLoading } = useShopOverview(detail?.user_id ?? null);

  const { data: shops, isLoading } = useAdminShops();

  const deleteShop = useMutation({
    mutationFn: async ({ userId, force }: { userId: string; force: boolean }) => {
      const { data, error } = await (supabase as any).rpc("admin_delete_shop", {
        p_user_id: userId,
        p_force: force,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur");
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
      queryClient.invalidateQueries({ queryKey: ["all-shops"] });
      toast({ title: "Boutique supprimée", description: `${data.deleted_products} produit(s) supprimé(s)` });
      setTarget(null);
      setConfirmText("");
    },
    onError: (e: any) => {
      toast({
        title: "Erreur",
        description:
          e.message === "ACTIVE_ORDERS"
            ? "Ce vendeur a encore des commandes en cours."
            : e.message,
        variant: "destructive",
      });
    },
  });

  const filtered = (shops || []).filter(
    (s: any) =>
      s.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.shop_city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Store className="h-6 w-6 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{shops?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Boutiques actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-6 w-6 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">
              {(shops || []).reduce((a: number, s: any) => a + s.product_count, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Produits au total</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher une boutique ou une ville..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Aucune boutique</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Boutique</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Produits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.shop_name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {s.shop_city}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{s.shop_phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.product_count}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setTarget(s);
                        setConfirmText("");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement « {target?.shop_name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les produits, la connexion Shopify et le rôle vendeur seront supprimés. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Tapez SUPPRIMER pour confirmer"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim().toUpperCase() !== "SUPPRIMER" || deleteShop.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteShop.mutate({ userId: target.user_id, force: false });
              }}
            >
              {deleteShop.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
