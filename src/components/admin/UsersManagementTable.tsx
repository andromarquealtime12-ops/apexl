import { useState } from "react";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Eye, Pause, Play, Shield, Search, StickyNote, Star, 
  Snowflake, Ban, AlertTriangle, CreditCard, User,
  Trash2, Phone as PhoneIcon, History, DollarSign
} from "lucide-react";
import { 
  useAdminUsers, useSuspendUser, useActivateUser, useUpdateAdminNotes, 
  AdvancedUserProfile, useFreezeWallet, useUnfreezeWallet, useDeleteUser,
  useUserTransactions
} from "@/hooks/useAdminAdvanced";
import UserProfileDialog from "./UserProfileDialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function UsersManagementTable() {
  const [filters, setFilters] = useState({ role: "all", status: "all", search: "" });
  const [selectedUser, setSelectedUser] = useState<AdvancedUserProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<string>("7");
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [freezeDialog, setFreezeDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [freezeReason, setFreezeReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [txUser, setTxUser] = useState<AdvancedUserProfile | null>(null);

  const { data: users, isLoading } = useAdminUsers(filters);
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const updateNotes = useUpdateAdminNotes();
  const freezeWallet = useFreezeWallet();
  const unfreezeWallet = useUnfreezeWallet();
  const deleteUser = useDeleteUser();
  const { data: userTxs } = useUserTransactions(txUser?.user_id || null);
  const { toast } = useToast();

  const handleSuspend = async () => {
    if (!suspendDialog.user) return;
    try {
      await suspendUser.mutateAsync({
        userId: suspendDialog.user.user_id,
        reason: suspendReason,
        durationDays: suspendDuration === "permanent" ? null : parseInt(suspendDuration)
      });
      toast({ title: "Utilisateur suspendu" });
      setSuspendDialog({ open: false, user: null });
      setSuspendReason("");
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de suspendre l'utilisateur", variant: "destructive" });
    }
  };

  const handleActivate = async (user: AdvancedUserProfile) => {
    try {
      await activateUser.mutateAsync(user.user_id);
      toast({ title: "Utilisateur réactivé" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleSaveNotes = async () => {
    if (!notesDialog.user) return;
    try {
      await updateNotes.mutateAsync({ userId: notesDialog.user.user_id, notes: adminNotes });
      toast({ title: "Notes sauvegardées" });
      setNotesDialog({ open: false, user: null });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleFreezeWallet = async () => {
    if (!freezeDialog.user) return;
    try {
      await freezeWallet.mutateAsync({ userId: freezeDialog.user.user_id, reason: freezeReason });
      toast({ title: "Portefeuille gelé" });
      setFreezeDialog({ open: false, user: null });
      setFreezeReason("");
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;
    try {
      await deleteUser.mutateAsync(deleteDialog.user.user_id);
      toast({ title: "Compte supprimé" });
      setDeleteDialog({ open: false, user: null });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le compte", variant: "destructive" });
    }
  };

  const handleUnfreezeWallet = async (user: AdvancedUserProfile) => {
    try {
      await unfreezeWallet.mutateAsync(user.user_id);
      toast({ title: "Portefeuille dégelé" });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes("admin")) return <Badge variant="destructive">Admin</Badge>;
    if (roles.includes("seller")) return <Badge className="bg-purple-500">Vendeur</Badge>;
    if (roles.includes("driver")) return <Badge className="bg-orange-500">Livreur</Badge>;
    return <Badge variant="secondary">Acheteur</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Actif</Badge>;
      case "suspended": return <Badge variant="destructive">Suspendu</Badge>;
      case "banned": return <Badge className="bg-black text-white">Banni</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", { style: "decimal", minimumFractionDigits: 0 }).format(amount);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou téléphone..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select value={filters.role} onValueChange={(v) => setFilters(f => ({ ...f, role: v }))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="buyer">Acheteurs</SelectItem>
            <SelectItem value="seller">Vendeurs</SelectItem>
            <SelectItem value="driver">Livreurs</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
            <SelectItem value="banned">Bannis</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Score / Signalements</TableHead>
              <TableHead>Portefeuille</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id} className={user.wallet_frozen ? "bg-blue-50 dark:bg-blue-950/20" : ""}>
                <TableCell className="font-medium">
                  <div>
                    <div className="flex items-center gap-1">
                      {user.full_name}
                      {user.email_verified && <Shield className="h-3 w-3 text-green-500" />}
                      {user.identity_status === "verified" && <User className="h-3 w-3 text-blue-500" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.phone || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      Inscrit: {format(new Date(user.created_at), "dd MMM yyyy", { locale: fr })}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.roles)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{user.trust_score || 50}</span>
                    </div>
                    {(user.report_count || 0) > 0 && (
                      <div className="flex items-center gap-1 text-red-500">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-xs">{user.report_count} signalement(s)</span>
                      </div>
                    )}
                    {(user.lost_packages_count || 0) > 0 && (
                      <div className="flex items-center gap-1 text-orange-500">
                        <Ban className="h-3 w-3" />
                        <span className="text-xs">{user.lost_packages_count} colis perdu(s)</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="text-sm font-medium">RD$ {formatCurrency(user.wallet_balance_dop || 0)}</div>
                    {user.wallet_frozen && (
                      <Badge variant="outline" className="text-blue-500 border-blue-500">
                        <Snowflake className="h-3 w-3 mr-1" /> Gelé
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(user.account_status || "active")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 flex-wrap">
                    <Button variant="ghost" size="icon" onClick={() => setTxUser(user)} title="Historique">
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setProfileDialogOpen(true); }} title="Voir profil">
                      <Eye className="h-4 w-4" />
                    </Button>
                    {!user.wallet_frozen ? (
                      <Button variant="ghost" size="icon" onClick={() => setFreezeDialog({ open: true, user })} title="Geler portefeuille">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => handleUnfreezeWallet(user)} title="Dégeler">
                        <CreditCard className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    {user.account_status === "active" ? (
                      <Button variant="ghost" size="icon" onClick={() => setSuspendDialog({ open: true, user })} title="Suspendre">
                        <Pause className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => handleActivate(user)} title="Réactiver">
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setAdminNotes(user.admin_notes || ""); setNotesDialog({ open: true, user }); }} title="Notes">
                      <StickyNote className="h-4 w-4" />
                    </Button>
                    {user.phone && (
                      <Button variant="ghost" size="icon" asChild title="Appeler">
                        <a href={`tel:${user.phone}`}><PhoneIcon className="h-4 w-4 text-green-500" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, user })} title="Supprimer">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!users || users.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* User Profile Dialog */}
      <UserProfileDialog
        user={selectedUser}
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        onUnfreezeWallet={handleUnfreezeWallet}
      />

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ open, user: open ? suspendDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre {suspendDialog.user?.full_name}</DialogTitle>
            <DialogDescription>Cette action empêchera l'utilisateur d'accéder à son compte.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Durée</label>
              <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24 heures</SelectItem>
                  <SelectItem value="7">7 jours</SelectItem>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="permanent">Permanent (Ban)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Raison</label>
              <Textarea placeholder="Entrez la raison..." value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ open: false, user: null })}>Annuler</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason}>Suspendre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze Wallet Dialog */}
      <Dialog open={freezeDialog.open} onOpenChange={(open) => setFreezeDialog({ open, user: open ? freezeDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-blue-500" />
              Geler le portefeuille de {freezeDialog.user?.full_name}
            </DialogTitle>
            <DialogDescription>Solde actuel: RD$ {formatCurrency(freezeDialog.user?.wallet_balance_dop || 0)}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Raison du gel</label>
            <Textarea placeholder="Raison..." value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeDialog({ open: false, user: null })}>Annuler</Button>
            <Button onClick={handleFreezeWallet} disabled={!freezeReason} className="bg-blue-500 hover:bg-blue-600">
              <Snowflake className="h-4 w-4 mr-2" /> Geler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onOpenChange={(open) => setNotesDialog({ open, user: open ? notesDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes admin pour {notesDialog.user?.full_name}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Notes internes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={5} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ open: false, user: null })}>Annuler</Button>
            <Button onClick={handleSaveNotes}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Supprimer le compte de {deleteDialog.user?.full_name}
            </DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleteUser.isPending}>
              {deleteUser.isPending ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog */}
      <Dialog open={!!txUser} onOpenChange={(open) => !open && setTxUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Transactions de {txUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {userTxs && userTxs.length > 0 ? (
            <div className="space-y-2">
              {userTxs.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <span className="font-medium capitalize">{tx.type}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                    </p>
                    {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`font-bold ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}>
                      {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString()}
                    </span>
                    <div>
                      <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucune transaction</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
