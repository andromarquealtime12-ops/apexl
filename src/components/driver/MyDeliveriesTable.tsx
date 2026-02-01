import { useDriverDeliveries } from "@/hooks/useDriverStats";
import { useUpdateDeliveryStatus } from "@/hooks/useDriverActions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Clock, Package, Phone, Navigation } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; next?: string; nextLabel?: string }> = {
  ready_for_pickup: { 
    label: "À récupérer", 
    variant: "outline",
    next: "in_transit",
    nextLabel: "Démarrer livraison"
  },
  in_transit: { 
    label: "En livraison", 
    variant: "default",
    next: "delivered",
    nextLabel: "Marquer livrée"
  },
  delivered: { 
    label: "Livrée", 
    variant: "secondary"
  },
  cancelled: { 
    label: "Annulée", 
    variant: "destructive"
  },
};

export default function MyDeliveriesTable() {
  const { data: deliveries, isLoading } = useDriverDeliveries();
  const updateStatus = useUpdateDeliveryStatus();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ orderId, status: newStatus });
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activeDeliveries = deliveries?.filter(d => d.status !== "delivered" && d.status !== "cancelled") || [];
  const completedDeliveries = deliveries?.filter(d => d.status === "delivered" || d.status === "cancelled") || [];

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucune livraison assignée</p>
        <p className="text-sm">Acceptez des livraisons dans l'onglet "Disponibles"</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeDeliveries.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            En cours ({activeDeliveries.length})
          </h3>
          <div className="grid gap-4">
            {activeDeliveries.map((delivery) => {
              const status = statusConfig[delivery.status || "ready_for_pickup"];
              
              return (
                <Card key={delivery.id} className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono">
                          #{delivery.id.slice(0, 8)}
                        </Badge>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">{delivery.delivery_city || "Ville"}</p>
                          <p className="text-sm text-muted-foreground">
                            {delivery.delivery_address || "Adresse à confirmer"}
                          </p>
                        </div>
                      </div>

                      {delivery.delivery_notes && (
                        <p className="text-sm bg-muted/50 p-2 rounded italic">
                          "{delivery.delivery_notes}"
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-1">
                            <Navigation className="h-3 w-3" />
                            Itinéraire
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Phone className="h-3 w-3" />
                            Appeler
                          </Button>
                        </div>
                        
                        {status.next && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(delivery.id, status.next!)}
                            disabled={updateStatus.isPending}
                          >
                            {status.nextLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {completedDeliveries.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Historique ({completedDeliveries.length})
          </h3>
          <div className="grid gap-2">
            {completedDeliveries.slice(0, 10).map((delivery) => {
              const status = statusConfig[delivery.status || "delivered"];
              
              return (
                <Card key={delivery.id} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          #{delivery.id.slice(0, 8)}
                        </Badge>
                        <span className="text-sm">{delivery.delivery_city}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-green-600">
                          +{formatCurrency(delivery.delivery_fee || 0)}
                        </span>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
