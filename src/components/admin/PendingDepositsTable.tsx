import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  useAdminPendingDeposits, 
  useApproveDeposit, 
  useRejectDeposit,
  PendingDeposit
} from "@/hooks/useAdminWallet";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Eye, Loader2 } from "lucide-react";
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

export default function PendingDepositsTable() {
  const { data: deposits, isLoading } = useAdminPendingDeposits();
  const approveDeposit = useApproveDeposit();
  const rejectDeposit = useRejectDeposit();
  const { toast } = useToast();
  
  const [selectedDeposit, setSelectedDeposit] = useState<PendingDeposit | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (deposit: PendingDeposit) => {
    setProcessingId(deposit.id);
    try {
      await approveDeposit.mutateAsync(deposit.id);
      toast({
        title: "Dépôt approuvé",
        description: `${deposit.amount} ${deposit.currency} ajouté au portefeuille de ${deposit.user_name}`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'approuver le dépôt",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedDeposit) return;
    
    setProcessingId(selectedDeposit.id);
    try {
      await rejectDeposit.mutateAsync({ 
        transactionId: selectedDeposit.id, 
        reason: rejectReason || undefined 
      });
      toast({
        title: "Dépôt rejeté",
        description: "La demande de dépôt a été rejetée",
      });
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedDeposit(null);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de rejeter le dépôt",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (deposit: PendingDeposit) => {
    setSelectedDeposit(deposit);
    setShowRejectDialog(true);
  };

  const openProofViewer = (deposit: PendingDeposit) => {
    setSelectedDeposit(deposit);
    setShowProof(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!deposits || deposits.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Aucune demande de dépôt en attente
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead>Référence</TableHead>
            <TableHead>Preuve</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deposits.map((deposit) => (
            <TableRow key={deposit.id}>
              <TableCell className="whitespace-nowrap">
                {format(new Date(deposit.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
              </TableCell>
              <TableCell className="font-medium">
                {deposit.user_name}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {CURRENCY_SYMBOLS[deposit.currency as keyof typeof CURRENCY_SYMBOLS] || ""} 
                  {deposit.amount.toLocaleString()}
                </Badge>
              </TableCell>
              <TableCell>
                {PAYMENT_METHOD_LABELS[deposit.payment_method || ""] || deposit.payment_method}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {deposit.transaction_reference || "-"}
              </TableCell>
              <TableCell>
                {deposit.proof_image_url ? (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openProofViewer(deposit)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Voir
                  </Button>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => openRejectDialog(deposit)}
                    disabled={processingId === deposit.id}
                  >
                    {processingId === deposit.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(deposit)}
                    disabled={processingId === deposit.id}
                  >
                    {processingId === deposit.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Approuver
                      </>
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Proof Image Viewer */}
      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preuve de transaction</DialogTitle>
            <DialogDescription>
              Référence: {selectedDeposit?.transaction_reference || "N/A"}
            </DialogDescription>
          </DialogHeader>
          {selectedDeposit?.proof_image_url && (
            <ProofImageViewer proofPath={selectedDeposit.proof_image_url} />
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le dépôt</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir rejeter cette demande de dépôt ?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Raison du rejet (optionnel)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processingId === selectedDeposit?.id}
            >
              {processingId === selectedDeposit?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
