import { useState } from "react";
import {
  useDeliveryZones,
  useCreateDeliveryZone,
  useUpdateDeliveryZone,
  useDeleteDeliveryZone,
} from "@/hooks/useDeliveryZones";
import { DeliveryZone } from "@/utils/deliveryPricing";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  country: "DO",
  city: "",
  center_lat: 0,
  center_lng: 0,
  radius_km: 15,
  base_fee: 50,
  fee_per_km: 30,
  currency: "DOP",
  active: true,
};

export default function DeliveryZonesManager() {
  const { data: zones, isLoading } = useDeliveryZones(true);
  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();
  const deleteZone = useDeleteDeliveryZone();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (z: DeliveryZone) => {
    setEditingId(z.id);
    setForm({
      name: z.name,
      country: z.country,
      city: z.city ?? "",
      center_lat: Number(z.center_lat ?? 0),
      center_lng: Number(z.center_lng ?? 0),
      radius_km: Number(z.radius_km),
      base_fee: Number(z.base_fee),
      fee_per_km: Number(z.fee_per_km),
      currency: z.currency,
      active: z.active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const payload = {
      ...form,
      city: form.city || null,
      center_lat: form.center_lat || null,
      center_lng: form.center_lng || null,
    };
    try {
      if (editingId) {
        await updateZone.mutateAsync({ id: editingId, ...payload } as any);
        toast.success("Zone mise à jour");
      } else {
        await createZone.mutateAsync(payload as any);
        toast.success("Zone créée");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette zone ?")) return;
    try {
      await deleteZone.mutateAsync(id);
      toast.success("Zone supprimée");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleActive = (z: DeliveryZone) =>
    updateZone.mutate({ id: z.id, active: !z.active });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Zones de livraison
          </CardTitle>
          <CardDescription>
            Configurez les frais par ville : forfait de base + prix au km
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modifier la zone" : "Nouvelle zone"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Santo Domingo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pays</Label>
                  <Select
                    value={form.country}
                    onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DO">🇩🇴 République Dominicaine</SelectItem>
                      <SelectItem value="HT">🇭🇹 Haïti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Santo Domingo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude du centre</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.center_lat}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, center_lat: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude du centre</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.center_lng}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, center_lng: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rayon (km)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.radius_km}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, radius_km: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Frais de base</Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.base_fee}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, base_fee: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prix / km</Label>
                  <Input
                    type="number"
                    step="1"
                    value={form.fee_per_km}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fee_per_km: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">DOP (RD$)</SelectItem>
                      <SelectItem value="HTG">HTG</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <Label>Zone active</Label>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={createZone.isPending || updateZone.isPending}
              >
                {editingId ? "Mettre à jour" : "Créer la zone"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-3">
            {zones?.map((z) => (
              <div
                key={z.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{z.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {z.country}
                    </Badge>
                    {!z.active && (
                      <Badge variant="secondary" className="text-xs">
                        Désactivée
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Base {z.base_fee} {z.currency} + {z.fee_per_km} {z.currency}/km
                    {" • "}Rayon {z.radius_km} km
                  </p>
                </div>
                <Switch checked={z.active} onCheckedChange={() => toggleActive(z)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(z)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(z.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {(!zones || zones.length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Aucune zone configurée
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
