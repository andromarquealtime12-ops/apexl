import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  useAdminTransactionHistory,
  TransactionHistory
} from "@/hooks/useAdminWallet";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Eye, Search, ArrowUpDown } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/types/database";
import ProofImageViewer from "./ProofImageViewer";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  banreservas: "Banreservas",
  moncash: "Moncash",
  orange_money: "Orange Money",
  bhd: "BHD León",
  bank_transfer_do: "Virement RD",
  bank_transfer_ht: "Virement HT",
  card_visa: "Visa",
  card_mastercard: "Mastercard"
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Dépôt",
  withdrawal: "Retrait",
  payment: "Paiement",
  refund: "Remboursement",
  transfer: "Transfert"
};

export default function TransactionHistoryTable() {
  const { data: transactions, isLoading } = useAdminTransactionHistory();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionHistory | null>(null);
  const [showProof, setShowProof] = useState(false);

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch = 
      tx.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  const openProofViewer = (tx: TransactionHistory) => {
    setSelectedTransaction(tx);
    setShowProof(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="completed">Approuvé</SelectItem>
            <SelectItem value="failed">Rejeté</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="deposit">Dépôt</SelectItem>
            <SelectItem value="withdrawal">Retrait</SelectItem>
            <SelectItem value="payment">Paiement</SelectItem>
            <SelectItem value="refund">Remboursement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTransactions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Aucune transaction dans l'historique
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Preuve</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(tx.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {tx.user_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABELS[tx.type] || tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {CURRENCY_SYMBOLS[tx.currency as keyof typeof CURRENCY_SYMBOLS] || ""} 
                      {tx.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {PAYMENT_METHOD_LABELS[tx.payment_method || ""] || tx.payment_method || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-[120px] truncate">
                    {tx.transaction_reference || "-"}
                  </TableCell>
                  <TableCell>
                    {tx.status === "completed" ? (
                      <Badge variant="default">
                        <Check className="h-3 w-3 mr-1" />
                        Approuvé
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <X className="h-3 w-3 mr-1" />
                        Rejeté
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {tx.proof_image_url ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => openProofViewer(tx)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Stats summary */}
      <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
        <span>
          Total: {filteredTransactions.length} transaction(s)
        </span>
        <span>
          Approuvées: {filteredTransactions.filter(t => t.status === "completed").length}
        </span>
        <span>
          Rejetées: {filteredTransactions.filter(t => t.status === "failed").length}
        </span>
      </div>

      {/* Proof Image Viewer */}
      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preuve de transaction</DialogTitle>
            <DialogDescription>
              Référence: {selectedTransaction?.transaction_reference || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction?.proof_image_url && (
            <ProofImageViewer proofPath={selectedTransaction.proof_image_url} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
