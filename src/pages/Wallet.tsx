import { useState } from "react";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, useWalletTransactions, useDepositToWallet } from "@/hooks/useWallet";
import { PAYMENT_METHODS, CURRENCY_SYMBOLS, PaymentMethodType, Currency } from "@/types/database";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CreditCard, Smartphone, Building, Landmark, Clock 
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

const Wallet = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: transactionsLoading } = useWalletTransactions();
  const depositMutation = useDepositToWallet();

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<Currency>("DOP");
  const [depositMethod, setDepositMethod] = useState<PaymentMethodType>("card_visa");

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

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    try {
      await depositMutation.mutateAsync({
        amount,
        currency: depositCurrency,
        paymentMethod: depositMethod,
      });
      toast.success("Demande de dépôt enregistrée ! Elle sera traitée prochainement.");
      setDepositOpen(false);
      setDepositAmount("");
    } catch (error) {
      toast.error("Erreur lors du dépôt");
    }
  };

  const filteredPaymentMethods = PAYMENT_METHODS.filter(
    m => m.country === "both" || m.country === (depositCurrency === "HTG" ? "HT" : "DO")
  );

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
          <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="flex-1">
                <Plus className="h-5 w-5 mr-2" />
                Recharger
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Recharger mon portefeuille</DialogTitle>
                <DialogDescription>
                  Choisissez le montant et la méthode de paiement
                </DialogDescription>
              </DialogHeader>

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
                  onClick={handleDeposit}
                  disabled={depositMutation.isPending}
                >
                  {depositMutation.isPending ? "Traitement..." : "Confirmer le dépôt"}
                </Button>
              </div>
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
                {transactions?.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        tx.type === "deposit" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}>
                        {tx.type === "deposit" ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{tx.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type === "deposit" ? "+" : "-"}{CURRENCY_SYMBOLS[tx.currency]} {tx.amount.toLocaleString()}
                      </p>
                      <Badge variant={
                        tx.status === "completed" ? "default" : 
                        tx.status === "pending" ? "secondary" : "destructive"
                      }>
                        {tx.status === "completed" ? "Complété" : 
                         tx.status === "pending" ? "En attente" : "Échoué"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </main>
  );
};

export default Wallet;
