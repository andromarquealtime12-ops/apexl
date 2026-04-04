import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function RefundRequestsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: refunds, isLoading } = useQuery({
    queryKey: ["admin-refunds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const processMutation = useMutation({
    mutationFn: async ({ refundId, approved, adminNotes }: { refundId: string; approved: boolean; adminNotes?: string }) => {
      const { data, error } = await supabase.rpc("process_refund", {
        p_refund_id: refundId,
        p_approved: approved,
        p_notes: adminNotes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Remboursement traité" });
      queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const pending = refunds?.filter(r => r.status === "pending") || [];
  const processed = refunds?.filter(r => r.status !== "pending") || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Demandes de remboursement
          {pending.length > 0 && <Badge variant="destructive">{pending.length}</Badge>}
        </CardTitle>
        <CardDescription>Gérez les demandes de remboursement (fenêtre de 15 jours)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length === 0 && <p className="text-muted-foreground text-center py-4">Aucune demande en attente</p>}
        {pending.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-mono text-xs text-muted-foreground">Commande #{(r.order_id as string).slice(0, 8)}</p>
                <p className="font-medium">{r.amount} (montant)</p>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
              <Badge variant="secondary">En attente</Badge>
            </div>
            <Input
              placeholder="Notes admin (optionnel)"
              value={notes[r.id] || ""}
              onChange={(e) => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => processMutation.mutate({ refundId: r.id, approved: true, adminNotes: notes[r.id] })}
                disabled={processMutation.isPending}>
                <Check className="h-3.5 w-3.5 mr-1" /> Approuver
              </Button>
              <Button size="sm" variant="destructive" onClick={() => processMutation.mutate({ refundId: r.id, approved: false, adminNotes: notes[r.id] })}
                disabled={processMutation.isPending}>
                <X className="h-3.5 w-3.5 mr-1" /> Refuser
              </Button>
            </div>
          </div>
        ))}
        {processed.length > 0 && (
          <div className="pt-4 border-t space-y-2">
            <p className="text-sm font-medium">Historique</p>
            {processed.slice(0, 10).map((r) => (
              <div key={r.id} className="flex justify-between items-center text-sm border rounded p-2">
                <span className="font-mono text-xs">#{(r.order_id as string).slice(0, 8)} - {r.amount}</span>
                <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                  {r.status === "approved" ? "Approuvé" : r.status === "rejected" ? "Refusé" : "Expiré"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
