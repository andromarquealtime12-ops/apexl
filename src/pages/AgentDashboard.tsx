import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, ArrowDownCircle, ArrowUpCircle, Loader2, History, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function useAgentRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agent-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role" as any, { _user_id: user.id, _role: "agent" });
      return !!data;
    },
    enabled: !!user,
  });
}

function useAgentHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agent-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get agent's deposit_agent record
      const { data: agentRecord } = await supabase
        .from("deposit_agents")
        .select("id")
        .eq("agent_user_id", user.id)
        .maybeSingle();
      if (!agentRecord) return [];
      const { data, error } = await supabase
        .from("agent_deposits")
        .select("*")
        .eq("agent_id", agentRecord.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

type Currency = "DOP" | "HTG" | "USD";
const CURRENCY_SYMBOLS: Record<Currency, string> = { DOP: "RD$", HTG: "G", USD: "$" };

export default function AgentDashboard() {
  const { user, loading } = useAuth();
  const { data: isAgent, isLoading: roleLoading } = useAgentRole();
  const { data: history = [] } = useAgentHistory();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [notes, setNotes] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  const deposit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("agent_deposit_to_wallet" as any, {
        p_customer_email: email,
        p_amount: parseFloat(amount),
        p_currency: currency,
        p_notes: notes || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data: any) => {
      toast.success(data.message);
      setEmail(""); setAmount(""); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["agent-history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("agent_withdraw_from_wallet" as any, {
        p_customer_email: email,
        p_amount: parseFloat(amount),
        p_currency: currency,
        p_notes: notes || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data: any) => {
      toast.success(data.message);
      setEmail(""); setAmount(""); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["agent-history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading || roleLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) return <Navigate to="/" replace />;
  if (!isAgent) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accès réservé aux agents</h1>
          <p className="text-muted-foreground">Cette page est réservée aux agents de dépôt autorisés.</p>
        </div>
      </div>
    );
  }

  const isPending = deposit.isPending || withdraw.isPending;
  const isFormValid = email.trim() && amount && parseFloat(amount) > 0;

  const filteredHistory = searchEmail
    ? history.filter((h: any) => h.admin_notes?.toLowerCase().includes(searchEmail.toLowerCase()))
    : history;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord Agent</h1>
            <p className="text-sm text-muted-foreground">Gérez les dépôts et retraits en espèces</p>
          </div>
        </div>

        <Tabs defaultValue="deposit" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposit"><ArrowDownCircle className="h-4 w-4 mr-1" /> Dépôt</TabsTrigger>
            <TabsTrigger value="withdraw"><ArrowUpCircle className="h-4 w-4 mr-1" /> Retrait</TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Historique</TabsTrigger>
          </TabsList>

          <TabsContent value="deposit">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dépôt en espèces</CardTitle>
                <CardDescription>Créditez le portefeuille d'un client après réception de l'argent liquide</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email du client</Label>
                  <Input type="email" placeholder="client@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Montant</Label>
                    <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
                  </div>
                  <div>
                    <Label>Devise</Label>
                    <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (Peso)</SelectItem>
                        <SelectItem value="HTG">G (Gourde)</SelectItem>
                        <SelectItem value="USD">$ (Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes (optionnel)</Label>
                  <Textarea placeholder="Référence, détails..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
                <Button className="w-full" onClick={() => deposit.mutate()} disabled={isPending || !isFormValid}>
                  {deposit.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement...</> : <><ArrowDownCircle className="h-4 w-4 mr-2" /> Effectuer le dépôt</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdraw">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Retrait en espèces</CardTitle>
                <CardDescription>Débitez le portefeuille d'un client et remettez-lui l'argent liquide</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email du client</Label>
                  <Input type="email" placeholder="client@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Montant</Label>
                    <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
                  </div>
                  <div>
                    <Label>Devise</Label>
                    <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (Peso)</SelectItem>
                        <SelectItem value="HTG">G (Gourde)</SelectItem>
                        <SelectItem value="USD">$ (Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes (optionnel)</Label>
                  <Textarea placeholder="Référence, détails..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
                <Button variant="destructive" className="w-full" onClick={() => withdraw.mutate()} disabled={isPending || !isFormValid}>
                  {withdraw.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement...</> : <><ArrowUpCircle className="h-4 w-4 mr-2" /> Effectuer le retrait</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique des opérations</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." className="pl-9" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent>
                {filteredHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucune opération enregistrée</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredHistory.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">
                              {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {CURRENCY_SYMBOLS[item.currency as Currency] || ""}{item.amount}
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.status === "completed" ? "default" : "secondary"}>
                                {item.status === "completed" ? "Complété" : item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{item.admin_notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
