import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UtensilsCrossed, Check, X, Eye, Search, TrendingUp, Store, MapPin } from "lucide-react";

function useAdminRestaurants(status?: string) {
  return useQuery({
    queryKey: ["admin-restaurants", status],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("*").order("created_at", { ascending: false });
      if (status === "pending") query = query.eq("is_approved", false);
      if (status === "approved") query = query.eq("is_approved", true);
      const { data, error } = await query;
      if (error) throw error;
      // Fetch seller names
      const sellerIds = [...new Set((data || []).map(r => r.seller_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));
      return (data || []).map(r => ({ ...r, seller_name: profileMap[r.seller_id] || "—" }));
    },
  });
}

function useRestaurantStats() {
  return useQuery({
    queryKey: ["admin-restaurant-stats"],
    queryFn: async () => {
      const [restaurants, items] = await Promise.all([
        supabase.from("restaurants").select("id, is_approved, is_active"),
        supabase.from("restaurant_items").select("id, restaurant_id, is_available"),
      ]);
      const total = restaurants.data?.length || 0;
      const approved = restaurants.data?.filter(r => r.is_approved)?.length || 0;
      const pending = total - approved;
      const totalItems = items.data?.length || 0;
      const availableItems = items.data?.filter(i => i.is_available)?.length || 0;
      return { total, approved, pending, totalItems, availableItems };
    },
  });
}

function useRestaurantItems(restaurantId: string | null) {
  return useQuery({
    queryKey: ["admin-restaurant-items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("restaurant_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("category");
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });
}

export default function AdminRestaurantsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);

  const statusFilter = tab === "pending" ? "pending" : tab === "approved" ? "approved" : undefined;
  const { data: restaurants, isLoading } = useAdminRestaurants(statusFilter);
  const { data: stats } = useRestaurantStats();
  const { data: menuItems } = useRestaurantItems(selectedRestaurant);

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("restaurants").update({ is_approved: approved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-restaurant-stats"] });
      toast({ title: "Restaurant mis à jour" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("restaurants").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-restaurants"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const filtered = restaurants?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Store className="h-6 w-6 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total restaurants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Check className="h-6 w-6 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats?.approved || 0}</p>
            <p className="text-xs text-muted-foreground">Approuvés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-6 w-6 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UtensilsCrossed className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{stats?.totalItems || 0}</p>
            <p className="text-xs text-muted-foreground">Plats au menu</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Gestion des restaurants
          </CardTitle>
          <CardDescription>Approuvez, suspendez et gérez les restaurants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="pending">
                En attente
                {stats?.pending ? <Badge variant="destructive" className="ml-1 text-xs">{stats.pending}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="approved">Approuvés</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !filtered?.length ? (
            <p className="text-center text-muted-foreground py-8">Aucun restaurant trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Propriétaire</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.logo_url ? (
                            <img src={r.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <UtensilsCrossed className="h-8 w-8 p-1 bg-muted rounded-full" />
                          )}
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.cuisine_type}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.profiles?.full_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" /> {r.city}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={r.is_approved ? "default" : "secondary"}>
                            {r.is_approved ? "Approuvé" : "En attente"}
                          </Badge>
                          {!r.is_active && <Badge variant="destructive">Suspendu</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!r.is_approved ? (
                            <Button size="sm" variant="default" onClick={() => toggleApproval.mutate({ id: r.id, approved: true })}>
                              <Check className="h-3 w-3 mr-1" /> Approuver
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => toggleApproval.mutate({ id: r.id, approved: false })}>
                              <X className="h-3 w-3 mr-1" /> Révoquer
                            </Button>
                          )}
                          <Button size="sm" variant={r.is_active ? "destructive" : "outline"} onClick={() => toggleActive.mutate({ id: r.id, active: !r.is_active })}>
                            {r.is_active ? "Suspendre" : "Activer"}
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedRestaurant(r.id)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{r.name} — Menu</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">{r.description}</p>
                                <p className="text-sm"><strong>Adresse:</strong> {r.address}, {r.city}</p>
                                <p className="text-sm"><strong>Tél:</strong> {r.phone || "—"}</p>
                                <div className="border-t pt-4 mt-4">
                                  <h4 className="font-semibold mb-2">Menu ({menuItems?.length || 0} plats)</h4>
                                  {menuItems?.length ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Plat</TableHead>
                                          <TableHead>Catégorie</TableHead>
                                          <TableHead>Prix</TableHead>
                                          <TableHead>Dispo</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {menuItems.map(item => (
                                          <TableRow key={item.id}>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell>{item.category}</TableCell>
                                            <TableCell>{item.price} {item.currency}</TableCell>
                                            <TableCell>
                                              <Badge variant={item.is_available ? "default" : "secondary"}>
                                                {item.is_available ? "Oui" : "Non"}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Aucun plat au menu</p>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
