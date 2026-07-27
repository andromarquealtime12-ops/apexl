import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Currency, CURRENCY_SYMBOLS } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, MapPin, Phone, Info, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

function useActiveAgents() {
  return useQuery({
    queryKey: ["active-deposit-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_deposit_agents_public" as any);
      if (error) throw error;
      return data as any[];
    },
  });

}

export default function AgentDepositSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: agents, isLoading } = useActiveAgents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("DOP");
  const [reference, setReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const submitDeposit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error("Montant invalide");

      let proofUrl: string | null = null;
      if (proofFile) {
        const fileExt = proofFile.name.split(".").pop();
        const fileName = `agent-deposits/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("transaction-proofs")
          .upload(fileName, proofFile);
        if (uploadError) throw uploadError;
        proofUrl = fileName;
      }

      const { error } = await supabase.from("agent_deposits").insert({
        agent_id: selectedAgent,
        customer_user_id: user.id,
        amount: parsedAmount,
        currency,
        transaction_reference: reference || null,
        proof_image_url: proofUrl,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
      toast.success("Demande de dépôt via agent soumise ! Elle sera traitée par l'administrateur.");
      resetForm();
      setOpen(false);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erreur lors de la soumission");
    },
  });

  const resetForm = () => {
    setSelectedAgent("");
    setAmount("");
    setReference("");
    setProofFile(null);
    setProofPreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Max 5 MB");
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (isLoading || !agents?.length) return null;

  const selectedAgentData = agents.find((a: any) => a.id === selectedAgent);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5" />
          Dépôt via Agent
        </CardTitle>
        <CardDescription>
          Déposez de l'argent chez un agent autorisé près de chez vous
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {agents.map((agent: any) => (
            <div
              key={agent.id}
              className="border rounded-lg p-3 text-sm space-y-1"
            >
              <p className="font-medium">{agent.name}</p>
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {agent.address}, {agent.city}
              </p>
              {agent.phone && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" /> {agent.phone}
                </p>
              )}
              <Badge variant="outline" className="text-xs">Vérifié</Badge>
            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Building2 className="h-4 w-4 mr-2" />
              Soumettre un dépôt via agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dépôt via Agent</DialogTitle>
              <DialogDescription>
                Rendez-vous chez l'agent, déposez l'argent, puis soumettez la preuve ici.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Agent</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger><SelectValue placeholder="Choisir un agent" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAgentData && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{selectedAgentData.name}</strong><br />
                    {selectedAgentData.address}, {selectedAgentData.city}
                  </AlertDescription>
                </Alert>
              )}


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Montant</Label>
                  <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
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
                <Label>Référence / Numéro de reçu</Label>
                <Input placeholder="Ex: REC-12345" value={reference} onChange={e => setReference(e.target.value)} />
              </div>

              <div>
                <Label>Photo du reçu (optionnel)</Label>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                {proofPreview ? (
                  <div className="relative">
                    <img src={proofPreview} alt="Reçu" className="w-full h-36 object-cover rounded-lg border" />
                    <Button variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={() => fileInputRef.current?.click()}>
                      Changer
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">Cliquez pour ajouter la photo</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => submitDeposit.mutate()}
                disabled={submitDeposit.isPending || !selectedAgent || !amount}
              >
                {submitDeposit.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi...</>
                ) : (
                  "Soumettre le dépôt"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
