import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Check, X, MapPin, Phone, Percent, Trash2, Edit } from "lucide-react";

function useAgents() {
  return useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposit_agents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useAgentDeposits() {
  return useQuery({
    queryKey: ["admin-agent-deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_deposits")
        .select("*, deposit_agents(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

const emptyAgent = { name: "", address: "", city: "", phone: "", whatsapp: "", commission_percent: "0", notes: "", agent_user_email: "" };

export default function AdminAgentsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useAgents();
  const { data: deposits } = useAgentDeposits();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyAgent);

  const createAgent = useMutation({
    mutationFn: async () => {
      let agentUserId: string | null = null;
      if (form.agent_user_email.trim()) {
        const { data } = await supabase.rpc("find_user_id_by_email" as any, {
          p_email: form.agent_user_email.trim(),
        });
        if (data) {
          agentUserId = data as string;
        } else {
          throw new Error("Aucun utilisateur trouvé avec cet email");
        }
      }

      const { error } = await supabase.from("deposit_agents").insert({
        name: form.name,
        address: form.address,
        city: form.city,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        commission_percent: parseFloat(form.commission_percent) || 0,
        notes: form.notes || null,
        is_verified: true,
        agent_user_id: agentUserId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      toast({ title: "Agent créé avec succès" });
      setShowCreate(false);
      setForm(emptyAgent);
    },
  });

  const toggleAgent = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("deposit_agents").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      toast({ title: "Agent mis à jour" });
    },
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deposit_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      toast({ title: "Agent supprimé" });
    },
  });

  const processDeposit = useMutation({
    mutationFn: async ({ id, approved, customerId, amount, currency }: { id: string; approved: boolean; customerId: string; amount: number; currency: string }) => {
      // Update agent deposit status
      const { error: updateError } = await supabase.from("agent_deposits").update({
        status: approved ? "approved" : "rejected",
        processed_at: new Date().toISOString(),
      }).eq("id", id);
      if (updateError) throw updateError;

      if (approved) {
        // Credit customer wallet
        const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", customerId).single();
        if (wallet) {
          const balanceField = currency === "HTG" ? "balance_htg" : currency === "USD" ? "balance_usd" : "balance_dop";
          // Use RPC or direct update through admin
          const { error: txError } = await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            type: "deposit",
            amount,
            currency,
            status: "completed",
            description: "Dépôt via agent",
          } as any);
          if (txError) throw txError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agent-deposits"] });
      toast({ title: "Dépôt traité" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Points de dépôt (Agents)
            </CardTitle>
            <CardDescription>Gérez les agents autorisés à recevoir des dépôts</CardDescription>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvel agent</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un point de dépôt</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nom *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Agent Central" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Adresse *</Label>
                    <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Ville *</Label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Commission (%)</Label>
                  <Input type="number" value={form.commission_percent} onChange={e => setForm(f => ({ ...f, commission_percent: e.target.value }))} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createAgent.mutate()} disabled={!form.name || !form.address || !form.city}>
                  Créer l'agent
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !agents?.length ? (
            <p className="text-center text-muted-foreground py-8">Aucun agent créé</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" /> {a.city}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {a.phone}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Percent className="h-3 w-3" /> {a.commission_percent}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={a.is_active ? "default" : "destructive"}>
                            {a.is_active ? "Actif" : "Inactif"}
                          </Badge>
                          <Badge variant={a.is_verified ? "default" : "secondary"}>
                            {a.is_verified ? "Vérifié" : "Non vérifié"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant={a.is_active ? "destructive" : "outline"} onClick={() => toggleAgent.mutate({ id: a.id, field: "is_active", value: !a.is_active })}>
                            {a.is_active ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteAgent.mutate(a.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
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

      {/* Agent Deposits */}
      {deposits && deposits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dépôts via agents</CardTitle>
            <CardDescription>Derniers dépôts effectués chez les agents</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.deposit_agents?.name || "—"}</TableCell>
                    <TableCell className="font-medium">{d.amount} {d.currency}</TableCell>
                    <TableCell className="text-sm">{d.transaction_reference || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                        {d.status === "approved" ? "Approuvé" : d.status === "rejected" ? "Rejeté" : "En attente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => processDeposit.mutate({ id: d.id, approved: true, customerId: d.customer_user_id, amount: d.amount, currency: d.currency })}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => processDeposit.mutate({ id: d.id, approved: false, customerId: d.customer_user_id, amount: d.amount, currency: d.currency })}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
