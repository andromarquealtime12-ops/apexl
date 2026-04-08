import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function NegativeBalanceManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: negativeWallets, isLoading } = useQuery({
    queryKey: ["negative-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("*, profiles!wallets_user_id_fkey(full_name, phone)")
        .or("balance_dop.lt.0,balance_htg.lt.0,balance_usd.lt.0");

      if (error) {
        // Fallback without join if FK doesn't exist
        const { data: walletsOnly, error: err2 } = await supabase
          .from("wallets")
          .select("*")
          .or("balance_dop.lt.0,balance_htg.lt.0,balance_usd.lt.0");
        if (err2) throw err2;

        // Fetch profiles separately
        const userIds = walletsOnly?.map(w => w.user_id) || [];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", userIds);

        return walletsOnly?.map(w => ({
          ...w,
          profile: profiles?.find(p => p.user_id === w.user_id)
        })) || [];
      }

      return data?.map(w => ({
        ...w,
        profile: (w as any).profiles
      })) || [];
    },
  });

  const clearBalance = useMutation({
    mutationFn: async ({ userId, currency }: { userId: string; currency: string }) => {
      const { data, error } = await supabase.rpc("admin_clear_negative_balance" as any, {
        p_user_id: userId,
        p_currency: currency,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["negative-wallets"] });
      toast({ title: "Solde corrigé", description: `Montant effacé: ${data.cleared_amount}` });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const wallets = negativeWallets || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Soldes négatifs ({wallets.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {wallets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            Aucun solde négatif
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>DOP</TableHead>
                <TableHead>HTG</TableHead>
                <TableHead>USD</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{w.profile?.full_name || "Inconnu"}</p>
                      <p className="text-xs text-muted-foreground">{w.profile?.phone || ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={w.balance_dop < 0 ? "text-destructive font-bold" : ""}>
                      RD$ {(w.balance_dop || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={w.balance_htg < 0 ? "text-destructive font-bold" : ""}>
                      G {(w.balance_htg || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={w.balance_usd < 0 ? "text-destructive font-bold" : ""}>
                      $ {(w.balance_usd || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {w.balance_dop < 0 && (
                        <Button size="sm" variant="outline" onClick={() => clearBalance.mutate({ userId: w.user_id, currency: "DOP" })}
                          disabled={clearBalance.isPending}>
                          {clearBalance.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear DOP"}
                        </Button>
                      )}
                      {w.balance_htg < 0 && (
                        <Button size="sm" variant="outline" onClick={() => clearBalance.mutate({ userId: w.user_id, currency: "HTG" })}
                          disabled={clearBalance.isPending}>
                          {clearBalance.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear HTG"}
                        </Button>
                      )}
                      {w.balance_usd < 0 && (
                        <Button size="sm" variant="outline" onClick={() => clearBalance.mutate({ userId: w.user_id, currency: "USD" })}
                          disabled={clearBalance.isPending}>
                          {clearBalance.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Clear USD"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
