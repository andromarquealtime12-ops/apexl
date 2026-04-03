import { useState, useRef, useEffect } from "react";
import { Navigate, useSearchParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, useWalletTransactions, useDepositToWallet, useRequestWithdrawal, PAYMENT_INSTRUCTIONS } from "@/hooks/useWallet";
import { PAYMENT_METHODS, CURRENCY_SYMBOLS, PaymentMethodType, Currency } from "@/types/database";
import { DemoStripePayment } from "@/components/checkout/DemoStripePayment";
import { PayPalPayment } from "@/components/checkout/PayPalPayment";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, 
  CreditCard, Smartphone, Building, Landmark, Clock, Upload, 
  Info, Copy, Check, Image as ImageIcon, Minus, Send, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const paymentMethodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  smartphone: Smartphone,
  building: Building,
  landmark: Landmark,
};

// Methods that require manual transfer with proof
const MANUAL_PAYMENT_METHODS: PaymentMethodType[] = [
  "banreservas", "bhd", "bank_transfer_do", "bank_transfer_ht", "moncash", "orange_money"
];

const Wallet = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: transactionsLoading } = useWalletTransactions();
  const depositMutation = useDepositToWallet();
  const withdrawalMutation = useRequestWithdrawal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositStep, setDepositStep] = useState<"method" | "transfer" | "proof">("method");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<Currency>("DOP");
  const [depositMethod, setDepositMethod] = useState<PaymentMethodType>("banreservas");
  const [transactionReference, setTransactionReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [cardDemoOpen, setCardDemoOpen] = useState(false);
  const [cardDemoAmount, setCardDemoAmount] = useState(0);

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState<Currency>("DOP");
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodType>("banreservas");
  const [withdrawAccount, setWithdrawAccount] = useState("");

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <Skeleton className="h-48 w-full" />
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const resetDepositForm = () => {
    setDepositStep("method");
    setDepositAmount("");
    setDepositMethod("banreservas");
    setTransactionReference("");
    setProofFile(null);
    setProofPreview(null);
  };

  const handleCopyAccount = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Numéro copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La taille du fichier ne doit pas dépasser 5 MB");
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    if (!transactionReference.trim()) {
      toast.error("Veuillez entrer le numéro de transaction");
      return;
    }

    if (!proofFile) {
      toast.error("Veuillez télécharger la preuve de transaction");
      return;
    }

    try {
      await depositMutation.mutateAsync({
        amount,
        currency: depositCurrency,
        paymentMethod: depositMethod,
        transactionReference: transactionReference.trim(),
        proofFile,
      });
      toast.success("Demande de dépôt enregistrée ! Elle sera vérifiée et traitée sous 24h.");
      setDepositOpen(false);
      resetDepositForm();
    } catch (error) {
      toast.error("Erreur lors du dépôt");
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    if (!withdrawAccount.trim()) {
      toast.error("Veuillez entrer les détails du compte");
      return;
    }
    try {
      await withdrawalMutation.mutateAsync({
        amount,
        currency: withdrawCurrency,
        paymentMethod: withdrawMethod,
        accountDetails: withdrawAccount.trim(),
      });
      toast.success("Demande de retrait soumise ! Elle sera traitée sous 24-48h.");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawAccount("");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du retrait");
    }
  };

  const filteredPaymentMethods = PAYMENT_METHODS.filter(
    m => m.country === "both" || m.country === (depositCurrency === "HTG" ? "HT" : "DO")
  ).filter(m => MANUAL_PAYMENT_METHODS.includes(m.value));

  const currentInstructions = PAYMENT_INSTRUCTIONS[depositMethod];
  const isManualMethod = MANUAL_PAYMENT_METHODS.includes(depositMethod);

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <WalletIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Mon Portefeuille</h1>
            <p className="text-muted-foreground">Gérez votre solde et vos transactions</p>
          </div>
        </div>

        {/* Balance Cards */}
        {walletLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-blue-100">Peso Dominicain</CardDescription>
                <CardTitle className="text-3xl">
                  RD$ {wallet?.balance_dop?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-red-100">Gourde Haïtienne</CardDescription>
                <CardTitle className="text-3xl">
                  G {wallet?.balance_htg?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-green-100">Dollar US</CardDescription>
                <CardTitle className="text-3xl">
                  $ {wallet?.balance_usd?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          {/* Withdraw Dialog */}
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="flex-1">
                <Minus className="h-5 w-5 mr-2" />
                Retirer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Retirer des fonds</DialogTitle>
                <DialogDescription>
                  Demandez un retrait vers votre compte bancaire ou mobile money
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Devise</Label>
                    <Select value={withdrawCurrency} onValueChange={(v) => setWithdrawCurrency(v as Currency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP">RD$ (Peso)</SelectItem>
                        <SelectItem value="HTG">G (Gourde)</SelectItem>
                        <SelectItem value="USD">$ (Dollar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Méthode de retrait</Label>
                  <Select value={withdrawMethod} onValueChange={(v) => setWithdrawMethod(v as PaymentMethodType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.filter(m => !m.value.startsWith("card_")).map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {withdrawMethod === "paypal" ? "Adresse email PayPal" :
                     withdrawMethod === "wise" ? "Email ou numéro Wise" :
                     withdrawMethod === "moncash" ? "Numéro Moncash" :
                     withdrawMethod === "orange_money" ? "Numéro Orange Money" :
                     withdrawMethod === "banreservas" ? "Numéro de compte Banreservas" :
                     withdrawMethod === "bhd" ? "Numéro de compte BHD León" :
                     withdrawMethod === "popular" ? "Numéro de compte Banco Popular" :
                     "Numéro de compte / coordonnées bancaires"}
                  </Label>
                  <Input
                    placeholder={
                      withdrawMethod === "paypal" ? "votre@email.com" :
                      withdrawMethod === "wise" ? "votre@email.com ou numéro" :
                      withdrawMethod === "moncash" || withdrawMethod === "orange_money" ? "+509 XXXX XXXX" :
                      withdrawMethod === "banreservas" || withdrawMethod === "bhd" || withdrawMethod === "popular" ? "Numéro de compte" :
                      "Entrez vos coordonnées bancaires"
                    }
                    value={withdrawAccount}
                    onChange={(e) => setWithdrawAccount(e.target.value)}
                  />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Le montant sera déduit immédiatement et le virement traité sous 24-48h. 
                    Si la demande est refusée, le montant sera remboursé.
                  </AlertDescription>
                </Alert>

                <Button
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={withdrawalMutation.isPending || !withdrawAmount || !withdrawAccount}
                >
                  {withdrawalMutation.isPending ? (
                    <span>Envoi...</span>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Demander le retrait
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Deposit Dialog */}
          <Dialog open={depositOpen} onOpenChange={(open) => {
            setDepositOpen(open);
            if (!open) resetDepositForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="flex-1">
                <Plus className="h-5 w-5 mr-2" />
                Recharger
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Recharger mon portefeuille</DialogTitle>
                <DialogDescription>
                  {depositStep === "method" && "Choisissez le montant et la méthode de paiement"}
                  {depositStep === "transfer" && "Effectuez le transfert vers le compte indiqué"}
                  {depositStep === "proof" && "Téléchargez la preuve de votre transaction"}
                </DialogDescription>
              </DialogHeader>

              {/* Step 1: Choose method */}
              {depositStep === "method" && (
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Montant</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Devise</Label>
                      <Select value={depositCurrency} onValueChange={(v) => setDepositCurrency(v as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOP">RD$ (Peso)</SelectItem>
                          <SelectItem value="HTG">G (Gourde)</SelectItem>
                          <SelectItem value="USD">$ (Dollar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Card (demo) top-up */}
                  <Card className="border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Carte bancaire (démo)
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Recharge instantanée (carte test 4242 4242 4242 4242)
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const amount = parseFloat(depositAmount);
                            if (isNaN(amount) || amount <= 0) {
                              toast.error("Veuillez entrer un montant valide");
                              return;
                            }
                            setCardDemoAmount(amount);
                            setCardDemoOpen(true);
                          }}
                        >
                          Payer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <Label>Méthode de paiement</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredPaymentMethods.map((method) => {
                        const Icon = paymentMethodIcons[method.icon] || CreditCard;
                        return (
                          <Button
                            key={method.value}
                            variant={depositMethod === method.value ? "default" : "outline"}
                            className="justify-start h-auto py-3"
                            onClick={() => setDepositMethod(method.value)}
                          >
                            <Icon className="h-4 w-4 mr-2" />
                            {method.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => {
                      const amount = parseFloat(depositAmount);
                      if (isNaN(amount) || amount <= 0) {
                        toast.error("Veuillez entrer un montant valide");
                        return;
                      }
                      setDepositStep("transfer");
                    }}
                  >
                    Continuer
                  </Button>
                </div>
              )}

              {/* Step 2: Transfer instructions */}
              {depositStep === "transfer" && currentInstructions && (
                <div className="space-y-4 pt-4">
                  <Alert className="bg-primary/10 border-primary">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Instructions de transfert</AlertTitle>
                    <AlertDescription className="mt-2">
                      {currentInstructions.instructions}
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {depositMethod === "moncash" || depositMethod === "orange_money" 
                              ? "Numéro" 
                              : "Numéro de compte"}
                          </p>
                          <p className="text-xl font-bold font-mono">{currentInstructions.accountNumber}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => handleCopyAccount(currentInstructions.accountNumber)}
                        >
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Nom du bénéficiaire</p>
                        <p className="font-semibold">{currentInstructions.accountName}</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Montant à envoyer</p>
                        <p className="text-xl font-bold text-primary">
                          {CURRENCY_SYMBOLS[depositCurrency]} {parseFloat(depositAmount).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDepositStep("method")} className="flex-1">
                      Retour
                    </Button>
                    <Button onClick={() => setDepositStep("proof")} className="flex-1">
                      J'ai effectué le transfert
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Upload proof */}
              {depositStep === "proof" && (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="transactionRef">Numéro de transaction / Référence</Label>
                    <Input
                      id="transactionRef"
                      placeholder="Ex: TXN123456789"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Photo de la preuve de transaction</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {proofPreview ? (
                      <div className="relative">
                        <img 
                          src={proofPreview} 
                          alt="Preuve de transaction" 
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-2 right-2"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Changer
                        </Button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                      >
                        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          Cliquez pour télécharger la photo du reçu
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG jusqu'à 5 MB
                        </p>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Votre demande sera vérifiée par notre équipe. Le solde sera crédité sous 24h après validation.
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDepositStep("transfer")} className="flex-1">
                      Retour
                    </Button>
                    <Button 
                      onClick={handleDeposit}
                      disabled={depositMutation.isPending || !transactionReference || !proofFile}
                      className="flex-1"
                    >
                      {depositMutation.isPending ? "Envoi..." : "Soumettre"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : transactions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune transaction pour le moment</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions?.map((tx) => {
                  const isPending = tx.status === "pending";
                  return (
                  <div 
                    key={tx.id} 
                    className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                      isPending ? "animate-pulse border-yellow-300 bg-yellow-50/50 dark:bg-yellow-900/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        isPending 
                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
                          : tx.type === "deposit" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}>
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : tx.type === "deposit" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize flex items-center gap-2">
                          {tx.type === "deposit" ? "Dépôt" : tx.type === "withdrawal" ? "Retrait" : tx.type}
                          {isPending && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs animate-bounce">
                              En cours...
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        isPending ? "text-yellow-600" :
                        tx.type === "deposit" ? "text-green-600" : "text-red-600"
                      }`}>
                        {tx.type === "deposit" ? "+" : "-"}{CURRENCY_SYMBOLS[tx.currency as Currency]} {tx.amount.toLocaleString()}
                      </p>
                      <Badge variant={
                        tx.status === "completed" ? "default" : 
                        tx.status === "pending" ? "secondary" : "destructive"
                      }>
                        {tx.status === "completed" ? "✓ Complété" : 
                         tx.status === "pending" ? "⏳ En attente" : "✗ Échoué"}
                      </Badge>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DemoStripePayment
        isOpen={cardDemoOpen}
        onClose={() => setCardDemoOpen(false)}
        amount={cardDemoAmount}
        currency={depositCurrency}
        onSuccess={async () => {
          const { error } = await supabase.rpc("demo_wallet_topup" as any, {
            p_amount: cardDemoAmount,
            p_currency: depositCurrency,
          });

          if (error) {
            toast.error("Erreur lors du paiement démo");
            return;
          }

          await queryClient.invalidateQueries({ queryKey: ["wallet"] });
          await queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
          setDepositOpen(false);
          resetDepositForm();
        }}
      />

      <Footer />
    </main>
  );
};

export default Wallet;