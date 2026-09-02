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
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setDetail(s)}>
                      <Eye className="h-4 w-4" />
                      Voir
                    </Button>
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

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {detail?.shop_name}
            </DialogTitle>
          </DialogHeader>

          {overviewLoading || !overview ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Produits", value: overview.products_total, icon: Package },
                  { label: "Actifs", value: overview.products_active, icon: Package },
                  { label: "Commandes", value: overview.orders_total, icon: TrendingUp },
                  { label: "Livrées", value: overview.orders_delivered, icon: TrendingUp },
                  { label: "En cours", value: overview.orders_active, icon: TrendingUp },
                  { label: "Annulées", value: overview.orders_cancelled, icon: TrendingUp },
                  { label: "Articles vendus", value: overview.items_sold, icon: Package },
                  { label: "Stock total", value: overview.stock_total, icon: Package },
                ].map((k) => (
                  <Card key={k.label}>
                    <CardContent className="p-3 text-center">
                      <k.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-xl font-bold">{fmt(k.value)}</p>
                      <p className="text-[11px] text-muted-foreground">{k.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" /> Chiffre d'affaires (livré)
                </h4>
                {(overview.revenue || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune vente</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {overview.revenue.map((r: any) => (
                      <Badge key={r.currency} variant="secondary" className="text-sm">
                        {fmt(r.amount)} {r.currency}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <h4 className="font-semibold">Vendeur</h4>
                  <p>Nom : {overview.profile?.full_name || "—"}</p>
                  <p>Téléphone : {overview.profile?.phone || "—"}</p>
                  <p>WhatsApp : {overview.profile?.whatsapp || "—"}</p>
                  <p>Pays / ville : {overview.profile?.country || "—"} / {overview.profile?.city || "—"}</p>
                  <p>Identité : {overview.profile?.identity_status || "—"}</p>
                  <p>Statut compte : {overview.profile?.account_status || "—"}</p>
                  <p>Score de confiance : {overview.profile?.trust_score ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">Boutique</h4>
                  <p>Type : {overview.application?.business_type || "—"}</p>
                  <p>Adresse : {overview.application?.shop_address || overview.profile?.shop_address || "—"}</p>
                  <p>Ville : {overview.application?.shop_city || "—"}</p>
                  <p>Téléphone : {overview.application?.shop_phone || "—"}</p>
                  <p className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> Note : {overview.rating?.avg ?? "—"} ({overview.rating?.count || 0} avis)
                  </p>
                  <p className="flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Solde : {fmt(overview.wallet?.balance_dop)} DOP ·{" "}
                    {fmt(overview.wallet?.balance_htg)} HTG · {fmt(overview.wallet?.balance_usd)} USD
                  </p>
                  <p>
                    Gains en attente : {fmt(overview.wallet?.earnings_dop)} DOP ·{" "}
                    {fmt(overview.wallet?.earnings_htg)} HTG · {fmt(overview.wallet?.earnings_usd)} USD
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-sm">Produits les plus vendus</h4>
                {(overview.top_products || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun produit</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Vendus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.top_products.map((p: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {p.name} {!p.is_active && <Badge variant="outline" className="ml-1">inactif</Badge>}
                          </TableCell>
                          <TableCell>{fmt(p.price)} {p.currency}</TableCell>
                          <TableCell>{p.stock_quantity}</TableCell>
                          <TableCell>{p.sold}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
