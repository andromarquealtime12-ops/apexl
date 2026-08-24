import { useOrderReturns, useApproveReturn, useConfirmReturnReceived } from "@/hooks/useReturns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Check, X, Key, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReturnChat from "./ReturnChat";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { fr, enUS, es, pt, de, it, zhCN, ar as arLocale } from "date-fns/locale";

const dateLocales: Record<string, Locale> = {
  fr, en: enUS, es, pt, de, it, zh: zhCN, ar: arLocale, ht: fr,
};

export default function SellerReturnManager() {
  const { t, i18n } = useTranslation();
  const { data: returns, isLoading } = useOrderReturns("seller");
  const approveReturn = useApproveReturn();
  const confirmReturn = useConfirmReturnReceived();
  const [faultType, setFaultType] = useState<string>("other");
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<string>("refund");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: t("sellerx.returns.status.pending"), variant: "outline" },
    approved: { label: t("sellerx.returns.status.approved"), variant: "default" },
    return_pickup_ready: { label: t("sellerx.returns.status.return_pickup_ready"), variant: "default" },
    return_in_transit: { label: t("sellerx.returns.status.return_in_transit"), variant: "default" },
    returned: { label: t("sellerx.returns.status.returned"), variant: "secondary" },
    refunded: { label: t("sellerx.returns.status.refunded"), variant: "outline" },
    rejected: { label: t("sellerx.returns.status.rejected"), variant: "destructive" },
    redelivery: { label: t("sellerx.returns.status.redelivery"), variant: "default" },
  };

  const activeReturns = returns?.filter(r => !["refunded", "rejected", "redelivery"].includes(r.status)) || [];

  if (isLoading) return null;
  if (activeReturns.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          {t("sellerx.returns.title")}
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

                <p className="text-sm"><strong>{t("sellerx.returns.reason")}:</strong> {ret.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(ret.created_at), { addSuffix: true, locale: dateLocales[i18n.language] || enUS })}
                </p>

                {/* Pending: approve/reject */}
                {ret.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Select value={faultType} onValueChange={setFaultType}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("sellerx.returns.faultTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller_fault">{t("sellerx.returns.faultSeller")}</SelectItem>
                        <SelectItem value="buyer_fault">{t("sellerx.returns.faultBuyer")}</SelectItem>
                        <SelectItem value="other">{t("sellerx.returns.faultOther")}</SelectItem>
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
                        {t("sellerx.returns.approve")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Return delivery code for seller */}
                {ret.status === "return_in_transit" && ret.return_delivery_code && (
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <Key className="h-4 w-4 mx-auto mb-1 text-primary" />
                    <p className="text-xs font-medium">{t("sellerx.returns.receiveCode")}</p>
                    <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
                      {ret.return_delivery_code}
                    </p>
                  </div>
                )}

                {/* Returned: inspect and decide */}
                {ret.status === "returned" && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">{t("sellerx.returns.inspectPrompt")}</p>
                    <Select value={confirmAction} onValueChange={setConfirmAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refund">{t("sellerx.returns.refundBuyer")}</SelectItem>
                        <SelectItem value="redeliver">{t("sellerx.returns.redeliverOrder")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder={t("sellerx.returns.notesPlaceholder")}
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
                      {t("sellerx.returns.confirm")}
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
                  💬 {isExpanded ? t("sellerx.returns.close") : t("sellerx.returns.communication")}
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
