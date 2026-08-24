import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      if (!user) throw new Error(t("walletx.agentDeposit.notAuthenticated"));
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error(t("walletx.agentDeposit.invalidAmount"));

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
      toast.success(t("walletx.agentDeposit.depositSuccess"));
      resetForm();
      setOpen(false);
    },
    onError: (e: any) => {
      toast.error(e.message || t("walletx.agentDeposit.submitError"));
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
        toast.error(t("walletx.agentDeposit.maxFileSize"));
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
          {t("walletx.agentDeposit.title")}
        </CardTitle>
        <CardDescription>
          {t("walletx.agentDeposit.description")}
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
              <Badge variant="outline" className="text-xs">{t("walletx.agentDeposit.verified")}</Badge>

            </div>
          ))}
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Building2 className="h-4 w-4 mr-2" />
              {t("walletx.agentDeposit.submitButton")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("walletx.agentDeposit.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("walletx.agentDeposit.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>{t("walletx.agentDeposit.agentLabel")}</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger><SelectValue placeholder={t("walletx.agentDeposit.choosePlaceholder")} /></SelectTrigger>
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
                  <Label>{t("walletx.agentDeposit.amount")}</Label>
                  <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div>
                  <Label>{t("walletx.agentDeposit.currency")}</Label>
                  <Select value={currency} onValueChange={v => setCurrency(v as Currency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOP">{t("walletx.withdrawDialog.currencyOptions.dop")}</SelectItem>
                      <SelectItem value="HTG">{t("walletx.withdrawDialog.currencyOptions.htg")}</SelectItem>
                      <SelectItem value="USD">{t("walletx.withdrawDialog.currencyOptions.usd")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{t("walletx.agentDeposit.reference")}</Label>
                <Input placeholder={t("walletx.agentDeposit.referencePlaceholder")} value={reference} onChange={e => setReference(e.target.value)} />
              </div>

              <div>
                <Label>{t("walletx.agentDeposit.receiptPhoto")}</Label>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                {proofPreview ? (
                  <div className="relative">
                    <img src={proofPreview} alt={t("walletx.agentDeposit.receiptAlt")} className="w-full h-36 object-cover rounded-lg border" />
                    <Button variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={() => fileInputRef.current?.click()}>
                      {t("walletx.agentDeposit.change")}
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  >
                    <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                    <p className="text-sm text-muted-foreground">{t("walletx.agentDeposit.clickToAddPhoto")}</p>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={() => submitDeposit.mutate()}
                disabled={submitDeposit.isPending || !selectedAgent || !amount}
              >
                {submitDeposit.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("walletx.agentDeposit.sending")}</>
                ) : (
                  t("walletx.agentDeposit.submit")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
