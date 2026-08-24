import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useSellerRestaurants,
  useCreateRestaurant,
  useUpdateRestaurant,
  useSellerRestaurantItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
} from "@/hooks/useRestaurants";
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
import RestaurantLocationCard from "./RestaurantLocationCard";

async function uploadRestaurantImage(userId: string, file: File) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/restaurant/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

/** Logo + cover photo manager for one restaurant. */
function RestaurantPhotos({ restaurant }: { restaurant: any }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const updateRestaurant = useUpdateRestaurant();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"logo_url" | "cover_url" | null>(null);

  const handleFile = async (field: "logo_url" | "cover_url", file: File) => {
    if (!user) return;
    setBusy(field);
    try {
      const url = await uploadRestaurantImage(user.id, file);
      await updateRestaurant.mutateAsync({ id: restaurant.id, [field]: url });
      toast.success(t("restox.uploaded"));
    } catch (e: any) {
      toast.error(e.message || t("restox.uploadError"));
    } finally {
      setBusy(null);
      if (logoRef.current) logoRef.current.value = "";
      if (coverRef.current) coverRef.current.value = "";
    }
  };

  const clear = async (field: "logo_url" | "cover_url") => {
    await updateRestaurant.mutateAsync({ id: restaurant.id, [field]: null });
  };

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="text-sm font-medium">{t("restox.photos")}</p>
        <p className="text-xs text-muted-foreground">{t("restox.photosDesc")}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {/* Logo */}
        <div className="space-y-2">
          <Label className="text-xs">{t("restox.logo")}</Label>
          {restaurant.logo_url ? (
            <div className="relative h-28 w-28 rounded-full overflow-hidden border">
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-full w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => clear("logo_url")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-28 w-28 rounded-full border-dashed flex-col gap-1"
              disabled={busy === "logo_url"}
              onClick={() => logoRef.current?.click()}
            >
              {busy === "logo_url" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              <span className="text-[11px] leading-tight">
                {busy === "logo_url" ? t("restox.uploading") : t("restox.addLogo")}
              </span>
            </Button>
          )}
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile("logo_url", f);
            }}
          />
        </div>

        {/* Cover */}
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs">{t("restox.cover")}</Label>
          {restaurant.cover_url ? (
            <div className="relative h-28 w-full rounded-lg overflow-hidden border">
              <img src={restaurant.cover_url} alt={restaurant.name} className="h-full w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => clear("cover_url")}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-28 w-full border-dashed gap-2"
              disabled={busy === "cover_url"}
              onClick={() => coverRef.current?.click()}
            >
              {busy === "cover_url" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              {busy === "cover_url" ? t("restox.uploading") : t("restox.addCover")}
            </Button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile("cover_url", f);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function RestaurantManager() {
  const { t } = useTranslation();
  const { data: restaurants, isLoading } = useSellerRestaurants();
  const createRestaurant = useCreateRestaurant();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", address: "", city: "", phone: "", whatsapp: "", cuisine_type: "haïtien" });

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.city) {
      toast.error(t("restox.requiredFields"));
      return;
    }
    await createRestaurant.mutateAsync(form);
    setShowCreate(false);
    setForm({ name: "", description: "", address: "", city: "", phone: "", whatsapp: "", cuisine_type: "haïtien" });
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            {t("restox.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("restox.subtitle")}</p>
        </div>
        <Dialog open={showCreate && !restaurants?.length} onOpenChange={setShowCreate}>
          {!restaurants?.length && (
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> {t("restox.create")}</Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("restox.newTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("restox.name")} *</Label>
                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("restox.description")}</Label>
                <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("restox.address")} *</Label>
                  <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t("restox.city")} *</Label>
                  <Input value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("restox.phone")}</Label>
                  <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+509..." />
                </div>
                <div className="space-y-2">
                  <Label>{t("restox.cuisine")}</Label>
                  <Select value={form.cuisine_type} onValueChange={(v) => setForm(p => ({ ...p, cuisine_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="haïtien">{t("restox.cuisines.haitian")}</SelectItem>
                      <SelectItem value="dominicain">{t("restox.cuisines.dominican")}</SelectItem>
                      <SelectItem value="américain">{t("restox.cuisines.american")}</SelectItem>
                      <SelectItem value="pizza">{t("restox.cuisines.pizza")}</SelectItem>
                      <SelectItem value="grillades">{t("restox.cuisines.grill")}</SelectItem>
                      <SelectItem value="fruits_de_mer">{t("restox.cuisines.seafood")}</SelectItem>
                      <SelectItem value="pâtisserie">{t("restox.cuisines.pastry")}</SelectItem>
                      <SelectItem value="général">{t("restox.cuisines.general")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={createRestaurant.isPending} className="w-full">
                {createRestaurant.isPending ? t("restox.creating") : t("restox.createBtn")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!restaurants?.length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">{t("restox.empty")}</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> {t("restox.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {restaurants.map((r: any) => (
            <Card key={r.id} className={`cursor-pointer transition-all ${selectedRestaurant === r.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedRestaurant(selectedRestaurant === r.id ? null : r.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {r.logo_url ? (
                      <img src={r.logo_url} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-primary" />
                    )}
                    {r.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    {r.is_approved ? (
                      <Badge variant="default" className="bg-green-600">{t("restox.approved")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("restox.pending")}</Badge>
                    )}
                    {r.cuisine_type && <Badge variant="outline">{r.cuisine_type}</Badge>}
                  </div>
                </div>
                <CardDescription>{r.address}, {r.city}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RestaurantPhotos restaurant={r} />
                <RestaurantLocationCard
                  restaurantId={r.id}
                  address={r.address}
                  city={r.city}
                  latitude={r.latitude}
                  longitude={r.longitude}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedRestaurant && <MenuManager restaurantId={selectedRestaurant} />}
    </div>
  );
}

type MenuFormState = {
  name: string;
  description: string;
  price: string;
  category: string;
  preparation_time: string;
  image_url: string;
  is_available: boolean;
};

const EMPTY_FORM: MenuFormState = { name: "", description: "", price: "", category: "plat", preparation_time: "15", image_url: "", is_available: true };

function MenuItemDialog({
  open,
  onOpenChange,
  restaurantId,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  restaurantId: string;
  editing: any | null;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const createItem = useCreateMenuItem();
  const updateItem = useUpdateMenuItem();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<MenuFormState>(() => editing ? {
    name: editing.name || "",
    description: editing.description || "",
    price: String(editing.price ?? ""),
    category: editing.category || "plat",
    preparation_time: String(editing.preparation_time ?? "15"),
    image_url: editing.image_url || "",
    is_available: editing.is_available ?? true,
  } : EMPTY_FORM);

  const uploadImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadRestaurantImage(user.id, file);
      setForm(p => ({ ...p, image_url: url }));
      toast.success(t("restox.uploaded"));
    } catch (e: any) {
      toast.error(e.message || t("restox.uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      toast.error(t("restox.nameAndPrice"));
      return;
    }
    const payload = {
      restaurant_id: restaurantId,
      name: form.name,
      description: form.description || undefined,
      price: Number(form.price),
      category: form.category,
      preparation_time: Number(form.preparation_time) || 15,
      image_url: form.image_url || undefined,
      is_available: form.is_available,
    };
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createItem.mutateAsync(payload);
    }
    onOpenChange(false);
    setForm(EMPTY_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("restox.editDish") : t("restox.newDish")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image upload */}
          <div className="space-y-2">
            <Label>{t("restox.dishPhoto")}</Label>
            {form.image_url ? (
              <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                <img src={form.image_url} alt={form.name} className="w-full h-full object-cover" />
                <Button type="button" size="icon" variant="destructive" className="absolute top-2 right-2 h-7 w-7"
                  onClick={() => setForm(p => ({ ...p, image_url: "" }))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full h-32 border-dashed gap-2"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                {uploading ? t("restox.uploading") : t("restox.addPhoto")}
              </Button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
          </div>

          <div className="space-y-2">
            <Label>{t("restox.name")} *</Label>
            <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t("restox.description")}</Label>
            <Textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t("restox.price")} (HTG) *</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} placeholder="250" />
            </div>
            <div className="space-y-2">
              <Label>{t("restox.category")}</Label>
              <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plat">{t("restox.cats.plat")}</SelectItem>
                  <SelectItem value="entrée">{t("restox.cats.entree")}</SelectItem>
                  <SelectItem value="boisson">{t("restox.cats.boisson")}</SelectItem>
                  <SelectItem value="dessert">{t("restox.cats.dessert")}</SelectItem>
                  <SelectItem value="accompagnement">{t("restox.cats.accompagnement")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("restox.timeMin")}</Label>
              <Input type="number" value={form.preparation_time} onChange={(e) => setForm(p => ({ ...p, preparation_time: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <Label className="cursor-pointer">{t("restox.available")}</Label>
            <Switch checked={form.is_available} onCheckedChange={(v) => setForm(p => ({ ...p, is_available: v }))} />
          </div>
          <Button onClick={handleSubmit} disabled={createItem.isPending || updateItem.isPending || uploading} className="w-full" size="lg">
            {(createItem.isPending || updateItem.isPending) ? t("restox.saving") : (editing ? t("restox.save") : t("restox.addDishBtn"))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MenuManager({ restaurantId }: { restaurantId: string }) {
  const { t } = useTranslation();
  const { data: items, isLoading } = useSellerRestaurantItems(restaurantId);
  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{t("restox.menu")}</CardTitle>
          <Button size="lg" className="gap-2 shadow-md" onClick={() => setShowAdd(true)}>
            <Plus className="h-5 w-5" /> {t("restox.addDish")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !items?.length ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <UtensilsCrossed className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground mb-3">{t("restox.noDishes")}</p>
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" /> {t("restox.addFirstDish")}
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 rounded-lg border">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-20 w-20 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="h-20 w-20 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                    {!item.is_available && <Badge variant="destructive" className="text-xs">{t("restox.unavailable")}</Badge>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-sm">
                    <span className="font-bold text-primary">{item.price} {item.currency}</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" /> {item.preparation_time}min
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(item)}>
                      <Edit className="h-3 w-3 mr-1" /> {t("restox.edit")}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => updateItem.mutate({ id: item.id, restaurant_id: restaurantId, is_available: !item.is_available })}>
                      {item.is_available ? t("restox.hide") : t("restox.show")}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                      onClick={() => deleteItem.mutate({ id: item.id, restaurantId })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <MenuItemDialog
        key={editing ? `edit-${editing.id}` : "add"}
        open={showAdd || !!editing}
        onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditing(null); } }}
        restaurantId={restaurantId}
        editing={editing}
      />
    </Card>
  );
}
