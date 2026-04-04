import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Check, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";
import ReturnChat from "@/components/returns/ReturnChat";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  return_pickup_ready: "default",
  return_in_transit: "default",
  returned: "secondary",
  refunded: "outline",
  rejected: "destructive",
  redelivery: "default",
};

export default function ReturnsManager() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: returns, isLoading } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_returns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const forceRefundMutation = useMutation({
    mutationFn: async ({ returnId, action }: { returnId: string; action: string }) => {
      const { data, error } = await supabase.rpc("confirm_return_received", {
        p_return_id: returnId,
        p_confirmed: true,
        p_notes: adminNotes || "Traité par admin",
        p_action: action,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      toast.success("Retour traité par admin");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return null;

  const activeReturns = returns?.filter(r => !["refunded", "rejected", "redelivery"].includes(r.status)) || [];
  const historyReturns = returns?.filter(r => ["refunded", "rejected", "redelivery"].includes(r.status)) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Gestion des retours
          {activeReturns.length > 0 && <Badge variant="destructive">{activeReturns.length}</Badge>}
        </CardTitle>
        <CardDescription>Gérez les demandes de retour et remboursements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeReturns.length === 0 && (
          <p className="text-center text-muted-foreground py-4">Aucun retour actif</p>
        )}

        {activeReturns.map((ret) => (
          <Card key={ret.id} className="border-orange-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">#{ret.order_id.slice(0, 8)}</Badge>
                  <Badge variant={statusColors[ret.status] || "outline"}>{ret.status}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(ret.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>

              <div className="text-sm space-y-1">
                <p><strong>Raison:</strong> {ret.reason}</p>
                <p><strong>Montant remboursable:</strong> {ret.refund_amount} DOP</p>
                {ret.fault_type && <p><strong>Faute:</strong> {ret.fault_type === "seller_fault" ? "Vendeur" : ret.fault_type === "buyer_fault" ? "Acheteur" : "Autre"}</p>}
              </div>

              {/* Admin actions for stuck returns */}
              {["returned", "pending", "approved"].includes(ret.status) && (
                <div className="space-y-2 pt-2 border-t">
                  <Textarea
                    placeholder="Notes admin..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={1}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={forceRefundMutation.isPending}
                      onClick={() => forceRefundMutation.mutate({ returnId: ret.id, action: "refund" })}
                    >
                      {forceRefundMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Rembourser
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={forceRefundMutation.isPending}
                      onClick={() => forceRefundMutation.mutate({ returnId: ret.id, action: "redeliver" })}
                    >
                      Re-livrer
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
              >
                💬 {expandedId === ret.id ? "Fermer" : "Communication"}
              </Button>
              {expandedId === ret.id && <ReturnChat returnId={ret.id} />}
            </CardContent>
          </Card>
        ))}

        {historyReturns.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              Historique ({historyReturns.length})
            </summary>
            <div className="space-y-2 mt-2">
              {historyReturns.slice(0, 10).map((ret) => (
                <div key={ret.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
                  <span className="font-mono">#{ret.order_id.slice(0, 8)}</span>
                  <Badge variant={statusColors[ret.status] || "outline"} className="text-xs">{ret.status}</Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
