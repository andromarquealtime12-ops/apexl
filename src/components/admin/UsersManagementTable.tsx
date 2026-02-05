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
 import { 
   Eye, Pause, Play, MessageSquare, Shield, 
   Search, StickyNote, Star
 } from "lucide-react";
 import { useAdminUsers, useSuspendUser, useActivateUser, useUpdateAdminNotes, AdvancedUserProfile } from "@/hooks/useAdminAdvanced";
 import { useToast } from "@/hooks/use-toast";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 
 export default function UsersManagementTable() {
   const [filters, setFilters] = useState({ role: "all", status: "all", search: "" });
   const [selectedUser, setSelectedUser] = useState<AdvancedUserProfile | null>(null);
   const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
   const [suspendReason, setSuspendReason] = useState("");
   const [suspendDuration, setSuspendDuration] = useState<string>("7");
   const [notesDialog, setNotesDialog] = useState<{ open: boolean; user: AdvancedUserProfile | null }>({ open: false, user: null });
   const [adminNotes, setAdminNotes] = useState("");
 
   const { data: users, isLoading } = useAdminUsers(filters);
   const suspendUser = useSuspendUser();
   const activateUser = useActivateUser();
   const updateNotes = useUpdateAdminNotes();
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
               <TableHead>Nom</TableHead>
               <TableHead>Type</TableHead>
               <TableHead>Inscrit le</TableHead>
               <TableHead>Dépensé/Gagné</TableHead>
               <TableHead>Score</TableHead>
               <TableHead>Statut</TableHead>
               <TableHead className="text-right">Actions</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {users?.map((user) => (
               <TableRow key={user.id}>
                 <TableCell className="font-medium">
                   <div>
                     {user.full_name}
                     {user.email_verified && <Shield className="inline h-3 w-3 ml-1 text-green-500" />}
                   </div>
                   <div className="text-xs text-muted-foreground">{user.phone || "—"}</div>
                 </TableCell>
                 <TableCell>{getRoleBadge(user.roles)}</TableCell>
                 <TableCell className="text-sm">
                   {format(new Date(user.created_at), "dd MMM yyyy", { locale: fr })}
                 </TableCell>
                 <TableCell className="text-sm">
                   <div className="text-green-600">+RD$ {formatCurrency(user.total_earned || 0)}</div>
                   <div className="text-red-600">-RD$ {formatCurrency(user.total_spent || 0)}</div>
                 </TableCell>
                 <TableCell>
                   <div className="flex items-center gap-1">
                     <Star className="h-4 w-4 text-yellow-500" />
                     <span>{user.trust_score || 50}</span>
                   </div>
                 </TableCell>
                 <TableCell>{getStatusBadge(user.account_status || "active")}</TableCell>
                 <TableCell className="text-right">
                   <div className="flex justify-end gap-1">
                     {/* View Profile */}
                     <Dialog>
                       <DialogTrigger asChild>
                         <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)}>
                           <Eye className="h-4 w-4" />
                         </Button>
                       </DialogTrigger>
                       <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                         <DialogHeader>
                           <DialogTitle>Profil de {user.full_name}</DialogTitle>
                         </DialogHeader>
                         <div className="grid grid-cols-2 gap-4 py-4">
                           <div>
                             <p className="text-sm font-medium">Téléphone</p>
                             <p className="text-muted-foreground">{user.phone || "—"}</p>
                           </div>
                           <div>
                             <p className="text-sm font-medium">Ville</p>
                             <p className="text-muted-foreground">{user.city || "—"}</p>
                           </div>
                           <div>
                             <p className="text-sm font-medium">Identité</p>
                             <Badge variant={user.identity_status === "verified" ? "default" : "secondary"}>
                               {user.identity_status || "Non vérifié"}
                             </Badge>
                           </div>
                           <div>
                             <p className="text-sm font-medium">Score de confiance</p>
                             <div className="flex items-center gap-2">
                               <div className="w-full bg-muted rounded-full h-2">
                                 <div 
                                   className="bg-primary h-2 rounded-full" 
                                   style={{ width: `${user.trust_score || 50}%` }}
                                 />
                               </div>
                               <span className="text-sm">{user.trust_score || 50}%</span>
                             </div>
                           </div>
                           <div>
                             <p className="text-sm font-medium">Total dépensé</p>
                             <p className="text-muted-foreground">RD$ {formatCurrency(user.total_spent || 0)}</p>
                           </div>
                           <div>
                             <p className="text-sm font-medium">Total gagné</p>
                             <p className="text-muted-foreground">RD$ {formatCurrency(user.total_earned || 0)}</p>
                           </div>
                           {user.suspension_reason && (
                             <div className="col-span-2">
                               <p className="text-sm font-medium text-destructive">Raison de suspension</p>
                               <p className="text-muted-foreground">{user.suspension_reason}</p>
                               {user.suspension_until && (
                                 <p className="text-xs text-muted-foreground">
                                   Jusqu'au {format(new Date(user.suspension_until), "dd MMM yyyy", { locale: fr })}
                                 </p>
                               )}
                             </div>
                           )}
                           {user.admin_notes && (
                             <div className="col-span-2">
                               <p className="text-sm font-medium">Notes admin</p>
                               <p className="text-muted-foreground bg-muted p-2 rounded text-sm">{user.admin_notes}</p>
                             </div>
                           )}
                         </div>
                       </DialogContent>
                     </Dialog>
 
                     {/* Suspend/Activate */}
                     {user.account_status === "active" ? (
                       <Button 
                         variant="ghost" 
                         size="icon"
                         onClick={() => setSuspendDialog({ open: true, user })}
                       >
                         <Pause className="h-4 w-4 text-destructive" />
                       </Button>
                     ) : (
                       <Button 
                         variant="ghost" 
                         size="icon"
                         onClick={() => handleActivate(user)}
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
                     >
                       <StickyNote className="h-4 w-4" />
                     </Button>
                   </div>
                 </TableCell>
               </TableRow>
             ))}
             {(!users || users.length === 0) && (
               <TableRow>
                 <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
     </div>
   );
 }