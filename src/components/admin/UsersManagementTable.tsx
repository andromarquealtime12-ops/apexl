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
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Eye, Pause, Play, Shield, Search, StickyNote, Star, 
  Snowflake, Ban, AlertTriangle, CreditCard, Image, User,
  Trash2, Mail, Phone as PhoneIcon, History, Send, DollarSign
} from "lucide-react";
import { 
  useAdminUsers, useSuspendUser, useActivateUser, useUpdateAdminNotes, 
  AdvancedUserProfile, useFreezeWallet, useUnfreezeWallet, useDeleteUser,
  useUserTransactions
} from "@/hooks/useAdminAdvanced";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

export default function UsersManagementTable() {
  const [filters, setFilters] = useState({ role: "all", status: "all", search: "" });
  const [selectedUser, setSelectedUser] = useState<AdvancedUserProfile | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<string>("7");
  const [notesDialog, setNotesDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [adminNotes, setAdminNotes] = useState("");
  const [freezeDialog, setFreezeDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
  const [freezeReason, setFreezeReason] = useState("");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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
      await updateNotes.mutateAsync({
        userId: notesDialog.user.user_id,
        notes: adminNotes
      });
      toast({ title: "Notes sauvegardées" });
      setNotesDialog({ open: false, user: null });
    } catch (error) {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleFreezeWallet = async () => {
    if (!freezeDialog.user) return;
    
    try {
      await freezeWallet.mutateAsync({
        userId: freezeDialog.user.user_id,
        reason: freezeReason
      });
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

  const getDocumentUrl = (path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("identity-documents").getPublicUrl(path);
    return data.publicUrl;
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
      case "under_review": return <Badge className="bg-yellow-500">En révision</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", { style: "decimal", minimumFractionDigits: 0 }).format(amount);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

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
                  <div className="flex items-center gap-2">
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
                    <div className="text-sm font-medium">
                      RD$ {formatCurrency(user.wallet_balance_dop || 0)}
                    </div>
                    {user.wallet_frozen && (
                      <Badge variant="outline" className="text-blue-500 border-blue-500">
                        <Snowflake className="h-3 w-3 mr-1" />
                        Gelé
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(user.account_status || "active")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {/* View Full Profile */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => { setTxUser(user); }}
                      title="Historique transactions"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Dialog open={profileDialogOpen && selectedUser?.id === user.id} onOpenChange={setProfileDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            Profil complet - {user.full_name}
                            {getRoleBadge(user.roles)}
                          </DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="info" className="w-full">
                          <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="info">Infos</TabsTrigger>
                            <TabsTrigger value="identity">Identité</TabsTrigger>
                            <TabsTrigger value="wallet">Finances</TabsTrigger>
                            <TabsTrigger value="transactions">Historique</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="info" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Contact</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-muted-foreground">{user.phone || "—"}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{user.city || "Ville non renseignée"}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Score de confiance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="flex items-center gap-2">
                                    <div className="w-full bg-muted rounded-full h-3">
                                      <div 
                                        className={`h-3 rounded-full ${
                                          (user.trust_score || 50) >= 70 ? 'bg-green-500' : 
                                          (user.trust_score || 50) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${user.trust_score || 50}%` }}
                                      />
                                    </div>
                                    <span className="font-bold">{user.trust_score || 50}%</span>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Signalements</p>
                                  <p className="text-2xl font-bold text-red-500">{user.report_count || 0}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Colis perdus</p>
                                  <p className="text-2xl font-bold text-orange-500">{user.lost_packages_count || 0}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Statut identité</p>
                                  <Badge variant={user.identity_status === "verified" ? "default" : "secondary"} className="mt-1">
                                    {user.identity_status || "Non vérifié"}
                                  </Badge>
                                </CardContent>
                              </Card>
                            </div>

                            {user.suspension_reason && (
                              <Card className="border-destructive">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm text-destructive">Suspension</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-muted-foreground">{user.suspension_reason}</p>
                                  {user.suspension_until && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Jusqu'au {format(new Date(user.suspension_until), "dd MMM yyyy HH:mm", { locale: fr })}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {user.admin_notes && (
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm">Notes admin</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">{user.admin_notes}</p>
                                </CardContent>
                              </Card>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="identity" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Image className="h-4 w-4" />
                                    Pièce d'identité (Recto)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {user.id_document_front ? (
                                    <a 
                                      href={getDocumentUrl(user.id_document_front) || "#"} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img 
                                        src={getDocumentUrl(user.id_document_front) || ""} 
                                        alt="ID Front" 
                                        className="w-full h-32 object-cover rounded border hover:opacity-80 transition"
                                      />
                                    </a>
                                  ) : (
                                    <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
                                      Non fourni
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Image className="h-4 w-4" />
                                    Pièce d'identité (Verso)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {user.id_document_back ? (
                                    <a 
                                      href={getDocumentUrl(user.id_document_back) || "#"} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img 
                                        src={getDocumentUrl(user.id_document_back) || ""} 
                                        alt="ID Back" 
                                        className="w-full h-32 object-cover rounded border hover:opacity-80 transition"
                                      />
                                    </a>
                                  ) : (
                                    <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
                                      Non fourni
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                              <Card>
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Selfie
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {user.selfie_photo ? (
                                    <a 
                                      href={getDocumentUrl(user.selfie_photo) || "#"} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img 
                                        src={getDocumentUrl(user.selfie_photo) || ""} 
                                        alt="Selfie" 
                                        className="w-full h-32 object-cover rounded border hover:opacity-80 transition"
                                      />
                                    </a>
                                  ) : (
                                    <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
                                      Non fourni
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                            <Card>
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">Statut de vérification</p>
                                    <p className="text-sm text-muted-foreground">
                                      {user.identity_status === "verified" 
                                        ? "Identité vérifiée et validée par l'admin" 
                                        : user.identity_status === "pending"
                                        ? "En attente de vérification"
                                        : user.identity_status === "rejected"
                                        ? "Documents refusés"
                                        : "Documents non soumis"}
                                    </p>
                                  </div>
                                  <Badge variant={user.identity_status === "verified" ? "default" : "secondary"} className="text-lg px-4 py-1">
                                    {user.identity_status || "Non vérifié"}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          </TabsContent>
                          
                          <TabsContent value="wallet" className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Balance DOP</p>
                                  <p className="text-2xl font-bold">RD$ {formatCurrency(user.wallet_balance_dop || 0)}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Balance HTG</p>
                                  <p className="text-2xl font-bold">HTG {formatCurrency(user.wallet_balance_htg || 0)}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Balance USD</p>
                                  <p className="text-2xl font-bold">$ {formatCurrency(user.wallet_balance_usd || 0)}</p>
                                </CardContent>
                              </Card>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Total dépensé</p>
                                  <p className="text-xl font-bold text-red-500">-RD$ {formatCurrency(user.total_spent || 0)}</p>
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="pt-4">
                                  <p className="text-xs text-muted-foreground">Total gagné</p>
                                  <p className="text-xl font-bold text-green-500">+RD$ {formatCurrency(user.total_earned || 0)}</p>
                                </CardContent>
                              </Card>
                            </div>
                            {user.wallet_frozen && (
                              <Card className="border-blue-500">
                                <CardContent className="pt-4 flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-blue-500">
                                    <Snowflake className="h-5 w-5" />
                                    <span className="font-medium">Portefeuille gelé</span>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleUnfreezeWallet(user)}
                                  >
                                    Dégeler
                                  </Button>
                                </CardContent>
                              </Card>
                            )}
                          </TabsContent>

                          <TabsContent value="transactions" className="space-y-4">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <History className="h-4 w-4" />
                                  Dernières transactions
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Cliquez sur l'icône historique dans la table pour charger les transactions.
                                </p>
                                {txUser?.user_id === user.user_id && userTxs && userTxs.length > 0 ? (
                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {userTxs.map((tx: any) => (
                                      <div key={tx.id} className="flex items-center justify-between p-2 rounded border text-sm">
                                        <div>
                                          <span className="font-medium capitalize">{tx.type}</span>
                                          <span className="text-xs text-muted-foreground ml-2">
                                            {format(new Date(tx.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={tx.type === "deposit" ? "text-green-600" : "text-red-600"}>
                                            {tx.type === "deposit" ? "+" : "-"}{tx.currency} {Number(tx.amount).toLocaleString()}
                                          </span>
                                          <Badge variant={tx.status === "completed" ? "default" : tx.status === "pending" ? "secondary" : "destructive"}>
                                            {tx.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-center text-muted-foreground py-4">Aucune transaction</p>
                                )}
                              </CardContent>
                            </Card>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>

                    {/* Freeze/Unfreeze Wallet */}
                    {!user.wallet_frozen ? (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setFreezeDialog({ open: true, user })}
                        title="Geler le portefeuille"
                      >
                        <Snowflake className="h-4 w-4 text-blue-500" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleUnfreezeWallet(user)}
                        title="Dégeler le portefeuille"
                      >
                        <CreditCard className="h-4 w-4 text-green-500" />
                      </Button>
                    )}

                    {/* Suspend/Activate */}
                    {user.account_status === "active" ? (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setSuspendDialog({ open: true, user })}
                        title="Suspendre le compte"
                      >
                        <Pause className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleActivate(user)}
                        title="Réactiver le compte"
                      >
                        <Play className="h-4 w-4 text-green-500" />
                      </Button>
                    )}

                    {/* Add Notes */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setAdminNotes(user.admin_notes || "");
                        setNotesDialog({ open: true, user });
                      }}
                      title="Notes admin"
                    >
                      <StickyNote className="h-4 w-4" />
                    </Button>

                    {/* Contact */}
                    {user.phone && (
                      <Button variant="ghost" size="icon" asChild title="Appeler">
                        <a href={`tel:${user.phone}`}>
                          <PhoneIcon className="h-4 w-4 text-green-500" />
                        </a>
                      </Button>
                    )}

                    {/* Delete */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setDeleteDialog({ open: true, user })}
                      title="Supprimer le compte"
                    >
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Textarea 
                placeholder="Entrez la raison de la suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ open: false, user: null })}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={!suspendReason}>
              Suspendre
            </Button>
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
            <DialogDescription>
              Cette action empêchera l'utilisateur d'effectuer des transactions.
              Solde actuel: RD$ {formatCurrency(freezeDialog.user?.wallet_balance_dop || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Raison du gel</label>
            <Textarea 
              placeholder="Entrez la raison du gel du portefeuille..."
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeDialog({ open: false, user: null })}>
              Annuler
            </Button>
            <Button onClick={handleFreezeWallet} disabled={!freezeReason} className="bg-blue-500 hover:bg-blue-600">
              <Snowflake className="h-4 w-4 mr-2" />
              Geler le portefeuille
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
          <Textarea 
            placeholder="Notes internes..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialog({ open: false, user: null })}>
              Annuler
            </Button>
            <Button onClick={handleSaveNotes}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Supprimer le compte de {deleteDialog.user?.full_name}
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes les données de l'utilisateur seront supprimées définitivement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>
              Annuler
            </Button>
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
              <DollarSign className="h-5 w-5" />
              Transactions de {txUser?.full_name}
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
