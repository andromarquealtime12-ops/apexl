import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSellerOrders } from "@/hooks/useSellerStats";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderReadyButton } from "./OrderReadyButton";
import OrderChat from "@/components/chat/OrderChat";
import { Package, Clock, CheckCircle, Truck, XCircle, MessageCircle, ChevronDown, ChevronUp, Banknote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Locale } from "date-fns";
import { fr, enUS, es, pt, de, it, zhCN, ar as arLocale } from "date-fns/locale";

import { RotateCcw, RefreshCw, DollarSign } from "lucide-react";

const dateLocales: Record<string, Locale> = {
  fr, en: enUS, es, pt, de, it, zh: zhCN, ar: arLocale, ht: fr,
};

export default function SellerOrdersTable() {
  const { t, i18n } = useTranslation();
  const { data: orders, isLoading } = useSellerOrders();
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    pending: { label: t("sellerx.orders.status.pending"), variant: "secondary", icon: Clock },
    confirmed: { label: t("sellerx.orders.status.confirmed"), variant: "default", icon: CheckCircle },
    preparing: { label: t("sellerx.orders.status.preparing"), variant: "outline", icon: Package },
    ready: { label: t("sellerx.orders.status.ready"), variant: "outline", icon: Package },
    ready_for_pickup: { label: t("sellerx.orders.status.ready"), variant: "outline", icon: Package },
    picked_up: { label: t("sellerx.orders.status.picked_up"), variant: "default", icon: Truck },
    in_transit: { label: t("sellerx.orders.status.in_transit"), variant: "default", icon: Truck },
    delivered: { label: t("sellerx.orders.status.delivered"), variant: "secondary", icon: CheckCircle },
    cancelled: { label: t("sellerx.orders.status.cancelled"), variant: "destructive", icon: XCircle },
    return_requested: { label: t("sellerx.orders.status.return_requested"), variant: "destructive", icon: RotateCcw },
    return_pickup_ready: { label: t("sellerx.orders.status.return_pickup_ready"), variant: "outline", icon: RotateCcw },
    return_in_transit: { label: t("sellerx.orders.status.return_in_transit"), variant: "default", icon: RotateCcw },
    returned: { label: t("sellerx.orders.status.returned"), variant: "secondary", icon: RotateCcw },
    refunded: { label: t("sellerx.orders.status.refunded"), variant: "destructive", icon: DollarSign },
    redelivery: { label: t("sellerx.orders.status.redelivery"), variant: "default", icon: RefreshCw },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>{t("sellerx.orders.empty.title")}</p>
        <p className="text-sm">{t("sellerx.orders.empty.subtitle")}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("sellerx.orders.table.order")}</TableHead>
            <TableHead>{t("sellerx.orders.table.products")}</TableHead>
            <TableHead>{t("sellerx.orders.table.total")}</TableHead>
            <TableHead>{t("sellerx.orders.table.status")}</TableHead>
            <TableHead>{t("sellerx.orders.table.date")}</TableHead>
            <TableHead className="text-right">{t("sellerx.orders.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const status = statusConfig[order.status || "pending"] || statusConfig["pending"];
            const StatusIcon = status.icon;
            const orderTotal = order.items.reduce((sum: number, item: any) => sum + Number(item.total_price), 0);
            const isActive = !["delivered", "cancelled"].includes(order.status || "");

            return (
              <React.Fragment key={order.id}>
                <TableRow>
                  <TableCell className="font-mono text-sm">
                    #{order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.items.slice(0, 2).map((item: any, idx: number) => (
                        <p key={idx} className="text-sm">
                          {item.quantity}x {item.products?.name || t("sellerx.orders.product")}
                          {(item.selected_color || item.selected_size) && (
                            <span className="text-muted-foreground">{" "}• {[item.selected_color, item.selected_size].filter(Boolean).join(" / ")}</span>
                          )}
                        </p>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-muted-foreground">
                          {t("sellerx.orders.more", { count: order.items.length - 2 })}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>{formatCurrency(orderTotal)}</div>
                      {order.payment_method === "cash" && (
                        <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                          <Banknote className="h-3 w-3" />
                          {t("sellerx.orders.cashReceive", { amount: formatCurrency(orderTotal) })}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(order.created_at), { 
                      addSuffix: true, 
                      locale: dateLocales[i18n.language] || enUS 
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setChatOrderId(chatOrderId === order.id ? null : order.id)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {chatOrderId === order.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      )}
                      <OrderReadyButton orderId={order.id} currentStatus={order.status || "pending"} />
                    </div>
                  </TableCell>
                </TableRow>
                {chatOrderId === order.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="p-3 bg-muted/30">
                      <OrderChat
                        orderId={order.id}
                        otherUserName={t("sellerx.orders.chatOtherUser")}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
