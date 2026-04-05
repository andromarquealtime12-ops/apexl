import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, CreditCard, Smartphone, Building, Landmark, Globe } from "lucide-react";
import { useDepositMethods, useCreateDepositMethod, useUpdateDepositMethod, useDeleteDepositMethod, DepositMethod } from "@/hooks/useDepositMethods";
import { toast } from "sonner";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  smartphone: Smartphone,
  building: Building,
  landmark: Landmark,
  globe: Globe,
};

const emptyForm = {
  method_key: "",
  label: "",
  method_type: "bank",
  account_number: "",
  account_name: "",
  instructions: "",
  country: "both",
  icon: "building",
  is_active: true,
  sort_order: 0,
};

export default function DepositMethodsManager() {
  const { data: methods, isLoading } = useDepositMethods();
  const createMethod = useCreateDepositMethod();
  const updateMethod = useUpdateDepositMethod();
  const deleteMethod = useDeleteDepositMethod();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleEdit = (method: DepositMethod) => {
    setEditingId(method.id);
    setForm({
      method_key: method.method_key,
      label: method.label,
      method_type: method.method_type,
      account_number: method.account_number || "",
      account_name: method.account_name || "",
      instructions: method.instructions || "",
      country: method.country,
      icon: method.icon || "building",
      is_active: method.is_active,
      sort_order: method.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.method_key || !form.label) {
      toast.error("Clé et nom sont obligatoires");
      return;
    }
    try {
      if (editingId) {
        await updateMethod.mutateAsync({ id: editingId, ...form });
        toast.success("Méthode mise à jour");
      } else {
        await createMethod.mutateAsync(form as any);
        toast.success("Méthode ajoutée");
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette méthode de dépôt ?")) return;
    try {
      await deleteMethod.mutateAsync(id);
      toast.success("Méthode supprimée");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (method: DepositMethod) => {
    await updateMethod.mutateAsync({ id: method.id, is_active: !method.is_active });
    toast.success(method.is_active ? "Désactivée" : "Activée");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Méthodes de dépôt
            </CardTitle>
            <CardDescription>Gérez les moyens de paiement disponibles pour les dépôts</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) { setEditingId(null); setForm(emptyForm); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Modifier" : "Ajouter"} une méthode</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Clé unique</Label>
                    <Input value={form.method_key} onChange={(e) => setForm(f => ({ ...f, method_key: e.target.value }))} placeholder="payoneer" disabled={!!editingId} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom affiché</Label>
                    <Input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Payoneer" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.method_type} onValueChange={(v) => setForm(f => ({ ...f, method_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Banque</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="digital">Digital (Wise, PayPal...)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pays</Label>
                    <Select value={form.country} onValueChange={(v) => setForm(f => ({ ...f, country: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Les deux</SelectItem>
                        <SelectItem value="DO">République Dominicaine</SelectItem>
                        <SelectItem value="HT">Haïti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Numéro de compte / Email</Label>
                    <Input value={form.account_number} onChange={(e) => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="Numéro ou email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du bénéficiaire</Label>
                    <Input value={form.account_name} onChange={(e) => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Ayiti Market" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <Textarea value={form.instructions} onChange={(e) => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Icône</Label>
                    <Select value={form.icon} onValueChange={(v) => setForm(f => ({ ...f, icon: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="building">🏦 Banque</SelectItem>
                        <SelectItem value="smartphone">📱 Mobile</SelectItem>
                        <SelectItem value="globe">🌐 Digital</SelectItem>
                        <SelectItem value="landmark">🏛️ Virement</SelectItem>
                        <SelectItem value="credit-card">💳 Carte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ordre d'affichage</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <Button className="w-full" onClick={handleSave} disabled={createMethod.isPending || updateMethod.isPending}>
                  {editingId ? "Mettre à jour" : "Ajouter"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : (
          <div className="space-y-3">
            {methods?.map((method) => {
              const Icon = iconMap[method.icon || "building"] || Building;
              return (
                <div key={method.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{method.label}</p>
                      <Badge variant="outline" className="text-xs">{method.method_key}</Badge>
                      {!method.is_active && <Badge variant="secondary" className="text-xs">Désactivée</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {method.account_number || "Non configuré"} • {method.account_name || "—"}
                    </p>
                  </div>
                  <Switch checked={method.is_active} onCheckedChange={() => handleToggle(method)} />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(method)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(method.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            {(!methods || methods.length === 0) && (
              <p className="text-center text-muted-foreground py-4">Aucune méthode configurée</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
