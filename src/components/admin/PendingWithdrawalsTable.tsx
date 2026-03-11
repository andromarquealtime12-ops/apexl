import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/types/database";

export default function PendingWithdrawalsTable() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["admin-pending-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*, wallets!inner(user_id)")
        .eq("type", "withdrawal")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data?.map((t: any) => t.wallets.user_id) || [])];
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        profiles = p || [];
      }

      return (data || []).map((tx: any) => {
        const profile = profiles.find((p: any) => p.user_id === tx.wallets.user_id);
        return { ...tx, user_name: profile?.full_name || "Inconnu" };
      });
    },
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (txId: string) => {
      const { data, error } = await supabase.rpc("approve_withdrawal" as any, {
        p_transaction_id: txId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] });
      toast({ title: "Retrait approuvé" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ txId, reason }: { txId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("reject_withdrawal" as any, {
        p_transaction_id: txId,
        p_reason: reason || "Refusé par admin",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] });
      setShowRejectDialog(false);
      setSelectedId(null);
      setRejectReason("");
      toast({ title: "Retrait refusé et montant remboursé" });
    },
  });

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (!withdrawals || withdrawals.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Aucune demande de retrait en attente</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((w: any) => (
            <TableRow key={w.id}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(w.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
              </TableCell>
              <TableCell className="font-medium">{w.user_name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {CURRENCY_SYMBOLS[w.currency as keyof typeof CURRENCY_SYMBOLS] || ""}{" "}
                  {w.amount?.toLocaleString()}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{w.payment_method?.replace(/_/g, " ") || "-"}</TableCell>
              <TableCell className="font-mono text-sm max-w-[150px] truncate">
                {w.transaction_reference || w.description?.replace("Retrait vers ", "") || "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={processingId === w.id}
                    onClick={() => { setSelectedId(w.id); setShowRejectDialog(true); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={processingId === w.id}
                    onClick={async () => {
                      setProcessingId(w.id);
                      try { await approveMutation.mutateAsync(w.id); }
                      catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
                      finally { setProcessingId(null); }
                    }}
                  >
                    {processingId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approuver</>}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le retrait</DialogTitle>
            <DialogDescription>Le montant sera remboursé au portefeuille de l'utilisateur.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Raison du rejet (optionnel)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={async () => {
                if (!selectedId) return;
                setProcessingId(selectedId);
                try { await rejectMutation.mutateAsync({ txId: selectedId, reason: rejectReason }); }
                catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
                finally { setProcessingId(null); }
              }}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
