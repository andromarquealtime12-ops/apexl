import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export const PrintfulSyncCard = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [productCount, setProductCount] = useState(0);

  const loadStatus = async () => {
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_printful", true);
    setProductCount(count || 0);
  };

  useEffect(() => { loadStatus(); }, [user]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("printful-sync-products");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de synchronisation");
      toast.success(`✅ ${data.imported} produit(s) Printful synchronisé(s)`);
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
              <Printer className="h-5 w-5" />
              Catalogue Printful (POD)
            </CardTitle>
            <CardDescription>
              Impression à la demande — Printful imprime et livre directement au client
            </CardDescription>
          </div>
          <Badge variant="default">USD</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-1">
          <p><strong>Produits importés:</strong> {productCount}</p>
          <p className="text-muted-foreground text-xs">
            Paiement wallet uniquement. À chaque commande, Printful reçoit l'ordre et expédie directement.
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="w-full">
          {syncing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronisation...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Synchroniser Printful</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
