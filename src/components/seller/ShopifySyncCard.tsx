import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const ShopifySyncCard = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [productCount, setProductCount] = useState(0);

  const loadStatus = async () => {
    if (!user) return;
    const { data: conn } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("seller_id", user.id)
      .maybeSingle();
    setConnection(conn);

    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("is_shopify", true);
    setProductCount(count || 0);
  };

  useEffect(() => { loadStatus(); }, [user]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("shopify-sync-products");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de synchronisation");
      toast.success(`✅ ${data.imported} produit(s) Shopify synchronisé(s)`);
      await loadStatus();
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Boutique Shopify
            </CardTitle>
            <CardDescription>
              Synchronisez vos produits Shopify avec Ayiti Market
            </CardDescription>
          </div>
          {connection?.is_active && <Badge variant="default">Connecté</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <div className="space-y-2 text-sm">
            <p><strong>Boutique:</strong> {connection.shop_domain}</p>
            <p><strong>Produits importés:</strong> {productCount}</p>
            {connection.last_sync_at && (
              <p className="text-muted-foreground">
                Dernière sync: {new Date(connection.last_sync_at).toLocaleString("fr-FR")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Cliquez pour importer vos produits depuis Shopify. Paiement par portefeuille uniquement, livraison gérée par Shopify.
          </p>
        )}

        <Button onClick={handleSync} disabled={syncing} className="w-full">
          {syncing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronisation...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Synchroniser les produits Shopify</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
