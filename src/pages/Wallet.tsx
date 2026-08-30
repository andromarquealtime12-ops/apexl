import { useState, useRef, useEffect } from "react";
import { Navigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, useWalletTransactions, useDepositToWallet, useRequestWithdrawal } from "@/hooks/useWallet";
import { CURRENCY_SYMBOLS, PaymentMethodType, Currency } from "@/types/database";
import { useDepositMethods, DepositMethod } from "@/hooks/useDepositMethods";
import { useCurrencyRates, convertCurrency } from "@/hooks/useCurrencyRates";
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
import { useTranslation } from "react-i18next";
import { getDateFnsLocale } from "@/i18n/dateLocale";
import AgentDepositSection from "@/components/wallet/AgentDepositSection";
import CurrencyConverterCard from "@/components/wallet/CurrencyConverterCard";

const paymentMethodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "credit-card": CreditCard,
  smartphone: Smartphone,
  building: Building,
  landmark: Landmark,
};

// All methods are now dynamic from DB

const Wallet = () => {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading, isSeller, isDriver, isAdmin } = useAuth();
  const canWithdraw = isSeller || isDriver || isAdmin;

  const queryClient = useQueryClient();
  
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: transactions, isLoading: transactionsLoading } = useWalletTransactions();
  const { data: depositMethodsData } = useDepositMethods();
  const { data: currencyRates } = useCurrencyRates();
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

  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawCurrency, setWithdrawCurrency] = useState<Currency>("DOP");
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodType | "busend">("banreservas");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [busendHolder, setBusendHolder] = useState<string | null>(null);
  const [busendChecking, setBusendChecking] = useState(false);
  const [busendError, setBusendError] = useState<string | null>(null);

  // Les dépôts MonCash non confirmés par l'API après 30 min sont annulés automatiquement
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.rpc("cancel_pending_moncash_deposits" as any, {
          p_reason: "MonCash non confirmé",
          p_older_than_minutes: 30,
        });
        if ((data as any)?.cancelled > 0) {
          queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
        }
      } catch { /* ignore */ }
    })();
  }, [user, queryClient]);

  const checkBusendAccount = async () => {
    const account = withdrawAccount.trim();
    if (!account) return;
    setBusendChecking(true);
    setBusendError(null);
    setBusendHolder(null);
    try {
      const { data, error } = await supabase.functions.invoke("busend-withdraw", {
        body: { mode: "lookup", accountNumber: account },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      if (!res?.holder_name) throw new Error(t("walletx.toasts.beneficiaryNotFound"));
      setBusendHolder(res.holder_name);
    } catch (e: any) {
      setBusendError(e.message || t("walletx.toasts.busendAccountNotFound"));
    } finally {
      setBusendChecking(false);
    }
  };




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
    toast.success(t("walletx.toasts.numberCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("walletx.toasts.fileTooLarge"));
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
      toast.error(t("walletx.toasts.invalidAmount"));
      return;
    }

    if (!transactionReference.trim()) {
      toast.error(t("walletx.toasts.enterTransactionNumber"));
      return;
    }

    if (!proofFile) {
      toast.error(t("walletx.toasts.uploadProof"));
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
      toast.success(t("walletx.toasts.depositSuccess"));
      setDepositOpen(false);
      resetDepositForm();
    } catch (error: any) {
      toast.error(error?.message || t("walletx.toasts.depositError"));
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("walletx.toasts.invalidAmount"));
      return;
    }
    if (!withdrawAccount.trim()) {
      toast.error(t("walletx.toasts.enterAccountDetails"));
      return;
    }
    try {
      if (withdrawMethod === "busend") {
        if (!busendHolder) {
          toast.error(t("walletx.toasts.verifyBusendFirst"));
          return;
        }
        // Automatic transfer to a BUSEND account (HTG / DOP / USD) — no admin approval
        const { data, error } = await supabase.functions.invoke("busend-withdraw", {
          body: {
            mode: "transfer",
            amount,
            currency: withdrawCurrency,
            accountNumber: withdrawAccount.trim(),
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success(t("walletx.toasts.busendWithdrawSuccess", { holder: busendHolder }));
        setBusendHolder(null);

      } else if (withdrawMethod === "moncash") {
        // Auto MonCash withdrawal via Bazik.io
        if (withdrawCurrency !== "HTG") {
          toast.error(t("walletx.toasts.moncashHtgOnly"));
          return;
        }
        const { data, error } = await supabase.functions.invoke("bazik-withdraw", {
          body: { amount, phoneNumber: withdrawAccount.trim() },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success(t("walletx.toasts.moncashWithdrawSuccess"));
      } else {
        await withdrawalMutation.mutateAsync({
          amount,
          currency: withdrawCurrency,
          paymentMethod: withdrawMethod as PaymentMethodType,
          accountDetails: withdrawAccount.trim(),
        });
        toast.success(t("walletx.toasts.withdrawSuccess"));
      }

      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawAccount("");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
    } catch (error: any) {
      toast.error(error.message || t("walletx.toasts.withdrawError"));
    }
  };

  // Use dynamic deposit methods from database — hide manual MonCash (auto via Bazik.io now)
  const filteredDepositMethods = (depositMethodsData || []).filter(
    m => (m.country === "both" || m.country === (depositCurrency === "HTG" ? "HT" : "DO"))
      && m.method_key !== "moncash"
  );

  const currentMethod = filteredDepositMethods.find(m => m.method_key === depositMethod);
  const isManualMethod = !!currentMethod;
  const isBazikWithdraw = withdrawMethod === "moncash";

  return (
    <main className="min-h-screen bg-background">
      <Header />

      <div className="container px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <WalletIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("walletx.title")}</h1>
            <p className="text-muted-foreground">{t("walletx.subtitle")}</p>
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
                <CardDescription className="text-blue-100">{t("walletx.balances.dop")}</CardDescription>
                <CardTitle className="text-3xl">
                  RD$ {wallet?.balance_dop?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-red-100">{t("walletx.balances.htg")}</CardDescription>
                <CardTitle className="text-3xl">
                  G {wallet?.balance_htg?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="pb-2">
                <CardDescription className="text-green-100">{t("walletx.balances.usd")}</CardDescription>
                <CardTitle className="text-3xl">
                  $ {wallet?.balance_usd?.toLocaleString() || "0"}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Currency Converter */}
        {currencyRates && currencyRates.length > 0 && (
          <CurrencyConverterCard 
            wallet={wallet} 
            currencyRates={currencyRates} 
            queryClient={queryClient}
          />
        )}

        {/* Actions */}
        <div className="flex gap-4 mb-8">
          {/* Withdraw Dialog */}
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline" className="flex-1">
                <Minus className="h-5 w-5 mr-2" />
                {t("walletx.actions.withdraw")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("walletx.withdrawDialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("walletx.withdrawDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("walletx.withdrawDialog.amount")}</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("walletx.withdrawDialog.currency")}</Label>
                    <Select value={withdrawCurrency} onValueChange={(v) => setWithdrawCurrency(v as Currency)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DOP">{t("walletx.withdrawDialog.currencyOptions.dop")}</SelectItem>
                        <SelectItem value="HTG">{t("walletx.withdrawDialog.currencyOptions.htg")}</SelectItem>
                        <SelectItem value="USD">{t("walletx.withdrawDialog.currencyOptions.usd")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("walletx.withdrawDialog.method")}</Label>
                  <Select value={withdrawMethod} onValueChange={(v) => setWithdrawMethod(v as PaymentMethodType | "busend")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="busend">{t("walletx.withdrawDialog.methodBusend")}</SelectItem>
                      {(depositMethodsData || []).map(m => (
                        <SelectItem key={m.method_key} value={m.method_key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                </div>

                <div className="space-y-2">
                  <Label>
                    {withdrawMethod === "busend" ? t("walletx.withdrawDialog.accountLabel.busend") :
                     withdrawMethod === "paypal" ? t("walletx.withdrawDialog.accountLabel.paypal") :
                     withdrawMethod === "wise" ? t("walletx.withdrawDialog.accountLabel.wise") :
                     withdrawMethod === "moncash" ? t("walletx.withdrawDialog.accountLabel.moncash") :
                     withdrawMethod === "orange_money" ? t("walletx.withdrawDialog.accountLabel.orange_money") :
                     withdrawMethod === "banreservas" ? t("walletx.withdrawDialog.accountLabel.banreservas") :
                     withdrawMethod === "bhd" ? t("walletx.withdrawDialog.accountLabel.bhd") :
                     withdrawMethod === "popular" ? t("walletx.withdrawDialog.accountLabel.popular") :
                     t("walletx.withdrawDialog.accountLabel.default")}
                  </Label>
                  <Input
                    placeholder={
                      withdrawMethod === "busend" ? t("walletx.withdrawDialog.accountPlaceholder.busend") :
                      withdrawMethod === "paypal" ? t("walletx.withdrawDialog.accountPlaceholder.paypal") :
                      withdrawMethod === "wise" ? t("walletx.withdrawDialog.accountPlaceholder.wise") :
                      withdrawMethod === "moncash" || withdrawMethod === "orange_money" ? t("walletx.withdrawDialog.accountPlaceholder.phone") :
                      withdrawMethod === "banreservas" || withdrawMethod === "bhd" || withdrawMethod === "popular" ? t("walletx.withdrawDialog.accountPlaceholder.accountNumber") :
                      t("walletx.withdrawDialog.accountPlaceholder.default")
                    }
                    value={withdrawAccount}
                    onChange={(e) => {
                      setWithdrawAccount(e.target.value);
                      if (withdrawMethod === "busend") {
                        setBusendHolder(null);
                        setBusendError(null);
                      }
                    }}
                  />
                  {withdrawMethod === "busend" && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={checkBusendAccount}
                        disabled={busendChecking || !withdrawAccount.trim()}
                      >
                        {busendChecking ? t("walletx.withdrawDialog.verifying") : t("walletx.withdrawDialog.verifyAccount")}
                      </Button>
                      {busendHolder && (
                        <p className="text-sm font-medium text-green-600">
                          {t("walletx.withdrawDialog.recipient", { name: busendHolder })}
                        </p>
                      )}
                      {busendError && (
                        <p className="text-sm text-destructive">{busendError}</p>
                      )}
                    </div>
                  )}
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {withdrawMethod === "busend"
                      ? t("walletx.withdrawDialog.infoBusend")
                      : isBazikWithdraw
                      ? t("walletx.withdrawDialog.infoMoncash")
                      : t("walletx.withdrawDialog.infoDefault")}

                  </AlertDescription>
                </Alert>


                <Button
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={withdrawalMutation.isPending || !withdrawAmount || !withdrawAccount || (withdrawMethod === "busend" && !busendHolder)}
                >
                  {withdrawalMutation.isPending ? (
                    <span>{t("walletx.withdrawDialog.sending")}</span>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {t("walletx.withdrawDialog.submit")}
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
                {t("walletx.actions.deposit")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("walletx.depositDialog.title")}</DialogTitle>
                <DialogDescription>
                  {depositStep === "method" && t("walletx.depositDialog.stepMethod")}
                  {depositStep === "transfer" && t("walletx.depositDialog.stepTransfer")}
                  {depositStep === "proof" && t("walletx.depositDialog.stepProof")}
                </DialogDescription>
              </DialogHeader>

              {/* Step 1: Choose method */}
              {depositStep === "method" && (
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("walletx.depositDialog.amount")}</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("walletx.depositDialog.currency")}</Label>
                      <Select value={depositCurrency} onValueChange={(v) => setDepositCurrency(v as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DOP">{t("walletx.withdrawDialog.currencyOptions.dop")}</SelectItem>
                          <SelectItem value="HTG">{t("walletx.withdrawDialog.currencyOptions.htg")}</SelectItem>
                          <SelectItem value="USD">{t("walletx.withdrawDialog.currencyOptions.usd")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  <Button
                    variant="default"
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    onClick={async () => {
                      const amount = parseFloat(depositAmount);
                      if (isNaN(amount) || amount <= 0) {
                        toast.error(t("walletx.toasts.enterValidAmount"));
                        return;
                      }
                       try {
                         toast.loading(t("walletx.toasts.preparingStripe"));
                         const { data, error } = await supabase.functions.invoke("stripe-wallet-topup", {
                           body: { amount, currency: depositCurrency, returnOrigin: window.location.origin },
                         });
                         toast.dismiss();
                         if (error) throw error;
                         if (data?.url) {
                           window.location.assign(data.url);
                           setDepositOpen(false);
                           resetDepositForm();
                         } else {
                           throw new Error(t("walletx.toasts.missingPaymentUrl"));
                         }
                      } catch (e: any) {
                        toast.dismiss();
                        toast.error(e.message || t("walletx.toasts.stripeError"));
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t("walletx.depositDialog.payByCard")}
                  </Button>

                  {depositCurrency === "HTG" && (
                    <Button
                      variant="default"
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                      onClick={async () => {
                        const amount = parseFloat(depositAmount);
                        if (isNaN(amount) || amount <= 0) {
                          toast.error(t("walletx.toasts.invalidAmount"));
                          return;
                        }
                        if (amount > 75000) {
                          toast.error(t("walletx.toasts.moncashMax"));
                          return;
                        }
                        try {
                          toast.loading(t("walletx.toasts.preparingMoncash"));
                          const { data, error } = await supabase.functions.invoke("bazik-deposit", {
                            body: { amount, description: `Recharge portefeuille APEXL ${amount} HTG` },
                          });
                          toast.dismiss();
                          if (error) throw error;
                          const d = data as any;
                          if (d?.error) throw new Error(d.error);
                          if (d?.redirectUrl) {
                            window.location.assign(d.redirectUrl);
                            setDepositOpen(false);
                            resetDepositForm();
                          } else {
                            throw new Error(t("walletx.toasts.missingMoncashUrl"));
                          }
                        } catch (e: any) {
                          toast.dismiss();
                          // MonCash non confirmé -> annuler immédiatement tous les dépôts MonCash en attente
                          try {
                            await supabase.rpc("cancel_pending_moncash_deposits" as any, {
                              p_reason: e?.message || "Transfert MonCash non confirmé",
                            });
                            queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
                            queryClient.invalidateQueries({ queryKey: ["wallet"] });
                          } catch {}
                          toast.error((e.message || t("walletx.toasts.moncashError")) + t("walletx.toasts.moncashCancelledSuffix"));
                        }
                      }}
                    >
                      <Smartphone className="h-4 w-4 mr-2" />
                      {t("walletx.depositDialog.payByMoncash")}
                    </Button>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">{t("walletx.depositDialog.orManualMethod")}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("walletx.depositDialog.paymentMethod")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredDepositMethods.map((method) => {
                        const Icon = paymentMethodIcons[method.icon || "building"] || CreditCard;
                        return (
                          <Button
                            key={method.method_key}
                            variant={depositMethod === method.method_key ? "default" : "outline"}
                            className="justify-start h-auto py-3"
                            onClick={() => setDepositMethod(method.method_key as PaymentMethodType)}
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
                        toast.error(t("walletx.toasts.enterValidAmount"));
                        return;
                      }
                      setDepositStep("transfer");
                    }}
                  >
                    {t("walletx.depositDialog.continue")}
                  </Button>
                </div>
              )}

              {/* Step 2: Transfer instructions */}
              {depositStep === "transfer" && currentMethod && (
                <div className="space-y-4 pt-4">
                  <Alert className="bg-primary/10 border-primary">
                    <Info className="h-4 w-4" />
                    <AlertTitle>{t("walletx.depositDialog.transferInstructions")}</AlertTitle>
                    <AlertDescription className="mt-2">
                      {currentMethod.instructions}
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {currentMethod.method_type === "mobile_money" 
                              ? t("walletx.depositDialog.numberLabel") 
                              : t("walletx.depositDialog.accountNumberOrEmail")}
                          </p>
                          <p className="text-xl font-bold font-mono">{currentMethod.account_number || t("walletx.depositDialog.notConfigured")}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={() => handleCopyAccount(currentMethod.account_number || "")}
                        >
                          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">{t("walletx.depositDialog.beneficiaryName")}</p>
                        <p className="font-semibold">{currentMethod.account_name || "—"}</p>
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">{t("walletx.depositDialog.amountToSend")}</p>
                        <p className="text-xl font-bold text-primary">
                          {CURRENCY_SYMBOLS[depositCurrency]} {parseFloat(depositAmount).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDepositStep("method")} className="flex-1">
                      {t("walletx.depositDialog.back")}
                    </Button>
                    <Button onClick={() => setDepositStep("proof")} className="flex-1">
                      {t("walletx.depositDialog.transferDone")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Upload proof */}
              {depositStep === "proof" && (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="transactionRef">{t("walletx.depositDialog.transactionRef")}</Label>
                    <Input
                      id="transactionRef"
                      placeholder="Ex: TXN123456789"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("walletx.depositDialog.proofPhoto")}</Label>
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
                          {t("walletx.depositDialog.changePhoto")}
                        </Button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                      >
                        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">
                          {t("walletx.depositDialog.clickToUpload")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("walletx.depositDialog.fileFormats")}
                        </p>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      {t("walletx.depositDialog.verificationInfo")}
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDepositStep("transfer")} className="flex-1">
                      {t("walletx.depositDialog.back")}
                    </Button>
                    <Button 
                      onClick={handleDeposit}
                      disabled={depositMutation.isPending || !transactionReference || !proofFile}
                      className="flex-1"
                    >
                      {depositMutation.isPending ? t("walletx.depositDialog.sending") : t("walletx.depositDialog.submit")}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Agent Deposit */}
        <AgentDepositSection />

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>{t("walletx.transactions.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : transactions?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("walletx.transactions.empty")}</p>
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
                          {tx.type === "deposit" ? t("walletx.transactions.deposit") : tx.type === "withdrawal" ? t("walletx.transactions.withdrawal") : tx.type}
                          {isPending && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs animate-bounce">
                              {t("walletx.transactions.inProgress")}
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), "d MMM yyyy, HH:mm", { locale: getDateFnsLocale(i18n.language) })}
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
                        {tx.status === "completed" ? t("walletx.transactions.completed") : 
                         tx.status === "pending" ? t("walletx.transactions.pending") : t("walletx.transactions.failed")}
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


      <Footer />
    </main>
  );
};

export default Wallet;