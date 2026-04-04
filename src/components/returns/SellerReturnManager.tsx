import { useOrderReturns, useApproveReturn, useConfirmReturnReceived } from "@/hooks/useReturns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Check, X, Key, Loader2 } from "lucide-react";
import { useState } from "react";
import ReturnChat from "./ReturnChat";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  return_pickup_ready: { label: "Livreur assigné", variant: "default" },
  return_in_transit: { label: "En transit", variant: "default" },
  returned: { label: "Retourné - À inspecter", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "outline" },
  rejected: { label: "Refusé", variant: "destructive" },
  redelivery: { label: "Re-livraison", variant: "default" },
};

export default function SellerReturnManager() {
  const { data: returns, isLoading } = useOrderReturns("seller");
  const approveReturn = useApproveReturn();
  const confirmReturn = useConfirmReturnReceived();
  const [faultType, setFaultType] = useState<string>("other");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<string>("refund");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeReturns = returns?.filter(r => !["refunded", "rejected", "redelivery"].includes(r.status)) || [];

  if (isLoading) return null;
  if (activeReturns.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Demandes de retour
          {activeReturns.length > 0 && (
            <Badge variant="destructive">{activeReturns.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeReturns.map((ret) => {
          const status = statusLabels[ret.status] || { label: ret.status, variant: "outline" as const };
          const isExpanded = expandedId === ret.id;

          return (
            <Card key={ret.id} className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">
                    #{ret.order_id.slice(0, 8)}
                  </Badge>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>

                <p className="text-sm"><strong>Raison:</strong> {ret.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(ret.created_at), { addSuffix: true, locale: fr })}
                </p>

                {/* Pending: approve/reject */}
                {ret.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Select value={faultType} onValueChange={setFaultType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type de faute" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller_fault">Faute vendeur</SelectItem>
                        <SelectItem value="buyer_fault">Faute acheteur</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        disabled={approveReturn.isPending}
                        onClick={() => approveReturn.mutate({ returnId: ret.id, faultType })}
                      >
                        {approveReturn.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Approuver
                      </Button>
                    </div>
                  </div>
                )}

                {/* Return delivery code for seller */}
                {ret.status === "return_in_transit" && ret.return_delivery_code && (
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Key className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-medium">Code de réception retour</p>
                    <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
                      {ret.return_delivery_code}
                    </p>
                  </div>
                )}

                {/* Returned: inspect and decide */}
                {ret.status === "returned" && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">Inspectez le colis et décidez:</p>
                    <Select value={confirmAction} onValueChange={setConfirmAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refund">Rembourser le client</SelectItem>
                        <SelectItem value="redeliver">Re-livrer la commande</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Notes sur l'état du colis..."
                      value={confirmNotes}
                      onChange={(e) => setConfirmNotes(e.target.value)}
                      rows={2}
                    />
                    <Button
                      className="w-full"
                      disabled={confirmReturn.isPending}
                      onClick={() => confirmReturn.mutate({
                        returnId: ret.id,
                        confirmed: true,
                        notes: confirmNotes,
                        action: confirmAction,
                      })}
                    >
                      {confirmReturn.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Confirmer
                    </Button>
                  </div>
                )}

                {/* Chat toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                >
                  💬 {isExpanded ? "Fermer" : "Communication"}
                </Button>
                {isExpanded && <ReturnChat returnId={ret.id} />}
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
