import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ShoppingCart, Search } from "lucide-react";
import { generateOrderReceipt } from "@/utils/generateReceipt";
import { toast } from "sonner";

export default function AdminOrdersManager() {
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, total_amount, currency, delivery_city, buyer_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const buyerIds = [...new Set((data || []).map((o: any) => o.buyer_id).filter(Boolean))];
      let profiles: Record<string, any> = {};
      if (buyerIds.length) {
        const { data: pr } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", buyerIds as string[]);
        profiles = Object.fromEntries((pr || []).map((p: any) => [p.user_id, p]));
      }
      return (data || []).map((o: any) => ({ ...o, buyer: profiles[o.buyer_id] }));
    },
  });

  const filtered = (orders || []).filter((o: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.id.toLowerCase().includes(s) ||
      o.buyer?.full_name?.toLowerCase().includes(s) ||
      o.buyer?.phone?.toLowerCase().includes(s) ||
      o.delivery_city?.toLowerCase().includes(s)
    );
  });

  const handleDownload = async (id: string) => {
    try {
      await generateOrderReceipt(id);
    } catch (e: any) {
      toast.error(e.message || "Erreur génération reçu");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" /> Commandes & Reçus
        </CardTitle>
        <CardDescription>
          Téléchargez le reçu PDF de n'importe quelle commande client
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par ID, acheteur, ville, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Acheteur</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reçu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">#{o.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-sm">{o.buyer?.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{o.delivery_city || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{o.status}</Badge></TableCell>
                    <TableCell className="text-right">{o.currency} {Number(o.total_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDownload(o.id)}>
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune commande</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
