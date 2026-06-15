import { useState, useRef } from "react";
import { useSellerRestaurants, useCreateRestaurant, useSellerRestaurantItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from "@/hooks/useRestaurants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UtensilsCrossed, Plus, Trash2, Clock, Store, Edit, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function RestaurantManager() {
  const { data: restaurants, isLoading } = useSellerRestaurants();
  const createRestaurant = useCreateRestaurant();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", address: "", city: "", phone: "", whatsapp: "", cuisine_type: "haïtien" });

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.city) {
      toast.error("Remplissez les champs obligatoires");
      return;
    }
    await createRestaurant.mutateAsync(form);
    setShowCreate(false);
    setForm({ name: "", description: "", address: "", city: "", phone: "", whatsapp: "", cuisine_type: "haïtien" });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            Mes Restaurants
          </h2>
          <p className="text-sm text-muted-foreground">Gérez vos restaurants et menus</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Créer un restaurant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouveau restaurant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Mon Restaurant" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Décrivez votre restaurant..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Adresse *</Label>
                  <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rue..." />
                </div>
                <div className="space-y-2">
                  <Label>Ville *</Label>
                  <Input value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Port-au-Prince" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+509..." />
                </div>
                <div className="space-y-2">
                  <Label>Type de cuisine</Label>
                  <Select value={form.cuisine_type} onValueChange={(v) => setForm(p => ({ ...p, cuisine_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="haïtien">Haïtien</SelectItem>
                      <SelectItem value="dominicain">Dominicain</SelectItem>
                      <SelectItem value="américain">Américain</SelectItem>
                      <SelectItem value="pizza">Pizza</SelectItem>
                      <SelectItem value="grillades">Grillades</SelectItem>
                      <SelectItem value="fruits_de_mer">Fruits de mer</SelectItem>
                      <SelectItem value="pâtisserie">Pâtisserie</SelectItem>
                      <SelectItem value="général">Général</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createRestaurant.isPending} className="w-full">
                {createRestaurant.isPending ? "Création..." : "Créer le restaurant"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!restaurants?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Vous n'avez pas encore de restaurant</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Créer mon premier restaurant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {restaurants.map((r) => (
            <Card key={r.id} className={`cursor-pointer transition-all ${selectedRestaurant === r.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedRestaurant(selectedRestaurant === r.id ? null : r.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Store className="h-5 w-5 text-primary" />
                    {r.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    {r.is_approved ? (
                      <Badge variant="default" className="bg-green-600">Approuvé</Badge>
                    ) : (
                      <Badge variant="secondary">En attente</Badge>
                    )}
                    {r.cuisine_type && <Badge variant="outline">{r.cuisine_type}</Badge>}
                  </div>
                </div>
                <CardDescription>{r.address}, {r.city}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {selectedRestaurant && <MenuManager restaurantId={selectedRestaurant} />}
    </div>
  );
}

function MenuManager({ restaurantId }: { restaurantId: string }) {
  const { data: items, isLoading } = useSellerRestaurantItems(restaurantId);
  const createItem = useCreateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "plat", preparation_time: "15" });

  const handleAdd = async () => {
    if (!form.name || !form.price) {
      toast.error("Nom et prix requis");
      return;
    }
    await createItem.mutateAsync({
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      category: form.category,
      preparation_time: Number(form.preparation_time) || 15,
    });
    setShowAdd(false);
    setForm({ name: "", description: "", price: "", category: "plat", preparation_time: "15" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Menu</CardTitle>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-3 w-3" /> Ajouter un plat</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau plat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Griot avec banane" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Décrivez le plat..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Prix (HTG) *</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} placeholder="250" />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plat">Plat</SelectItem>
                        <SelectItem value="entrée">Entrée</SelectItem>
                        <SelectItem value="boisson">Boisson</SelectItem>
                        <SelectItem value="dessert">Dessert</SelectItem>
                        <SelectItem value="accompagnement">Accompagnement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Temps (min)</Label>
                    <Input type="number" value={form.preparation_time} onChange={(e) => setForm(p => ({ ...p, preparation_time: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleAdd} disabled={createItem.isPending} className="w-full">
                  {createItem.isPending ? "Ajout..." : "Ajouter le plat"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !items?.length ? (
          <p className="text-center text-muted-foreground py-8">Aucun plat ajouté</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    {!item.is_available && <Badge variant="destructive" className="text-xs">Indisponible</Badge>}
                  </div>
                  {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="font-bold text-primary">{item.price} {item.currency}</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {item.preparation_time} min
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive"
                  onClick={() => deleteItem.mutate({ id: item.id, restaurantId })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
