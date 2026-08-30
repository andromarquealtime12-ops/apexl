 import { useState } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { 
   Dialog, DialogContent, DialogDescription, 
   DialogHeader, DialogTitle, DialogFooter 
 } from "@/components/ui/dialog";
 import { Textarea } from "@/components/ui/textarea";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Check, X, Eye, Shield, User } from "lucide-react";
 import { 
   usePendingIdentityVerifications, 
   useApproveIdentityVerification, 
   useRejectIdentityVerification 
 } from "@/hooks/useAdminAdvanced";
 import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useIdentityDocUrl } from "@/hooks/useIdentityDocUrl";

function IdDocImage({ value, alt }: { value?: string | null; alt: string }) {
  const { data: url, isLoading } = useIdentityDocUrl(value);
  if (!value || (!isLoading && !url)) {
    return <p className="text-muted-foreground text-sm">Image non disponible</p>;
  }
  if (isLoading) return <p className="text-muted-foreground text-sm">Chargement...</p>;
  return (
    <a href={url!} target="_blank" rel="noreferrer" className="w-full h-full">
      <img src={url!} alt={alt} className="w-full h-full object-cover" />
    </a>
  );
}

 
 export default function IdentityVerificationsManager() {
   const { data: verifications, isLoading } = usePendingIdentityVerifications();
   const approveVerification = useApproveIdentityVerification();
   const rejectVerification = useRejectIdentityVerification();
   const { toast } = useToast();
 
   const [viewDialog, setViewDialog] = useState<{ open: boolean; verification: any | null }>({ open: false, verification: null });
   const [rejectDialog, setRejectDialog] = useState<{ open: boolean; verificationId: string | null }>({ open: false, verificationId: null });
   const [rejectReason, setRejectReason] = useState("");
 
   const handleApprove = async (verificationId: string) => {
     try {
       await approveVerification.mutateAsync({ verificationId });
       toast({ title: "Identité approuvée ✓", description: "L'utilisateur a été notifié." });
       setViewDialog({ open: false, verification: null });
     } catch (error) {
       toast({ title: "Erreur", variant: "destructive" });
     }
   };
 
   const handleReject = async () => {
     if (!rejectDialog.verificationId || !rejectReason) return;
     
     try {
       await rejectVerification.mutateAsync({ 
         verificationId: rejectDialog.verificationId, 
         reason: rejectReason 
       });
       toast({ title: "Vérification refusée", description: "L'utilisateur a été notifié." });
       setRejectDialog({ open: false, verificationId: null });
       setRejectReason("");
     } catch (error) {
       toast({ title: "Erreur", variant: "destructive" });
     }
   };
 
   if (isLoading) {
     return <Skeleton className="h-48 w-full" />;
   }
 
   if (!verifications || verifications.length === 0) {
     return (
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Shield className="h-5 w-5" />
             Vérifications d'identité
           </CardTitle>
           <CardDescription>Aucune demande en attente</CardDescription>
         </CardHeader>
         <CardContent>
           <div className="text-center py-8 text-muted-foreground">
             <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
             <p>Toutes les demandes ont été traitées</p>
           </div>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <>
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Shield className="h-5 w-5" />
             Vérifications d'identité en attente
             <Badge variant="destructive">{verifications.length}</Badge>
           </CardTitle>
           <CardDescription>Validez les pièces d'identité des utilisateurs</CardDescription>
         </CardHeader>
         <CardContent>
           <div className="space-y-4">
             {verifications.map((v: any) => (
               <div key={v.id} className="flex items-center justify-between p-4 border rounded-lg">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                     <User className="h-5 w-5" />
                   </div>
                   <div>
                     <p className="font-medium">{v.profiles?.full_name || "Utilisateur"}</p>
                     <p className="text-sm text-muted-foreground">
                       Soumis le {format(new Date(v.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                     </p>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline" 
                     size="sm"
                     onClick={() => setViewDialog({ open: true, verification: v })}
                   >
                     <Eye className="h-4 w-4 mr-1" />
                     Voir
                   </Button>
                   <Button 
                     variant="default" 
                     size="sm"
                     onClick={() => handleApprove(v.id)}
                   >
                     <Check className="h-4 w-4 mr-1" />
                     Approuver
                   </Button>
                   <Button 
                     variant="destructive" 
                     size="sm"
                     onClick={() => setRejectDialog({ open: true, verificationId: v.id })}
                   >
                     <X className="h-4 w-4 mr-1" />
                     Refuser
                   </Button>
                 </div>
               </div>
             ))}
           </div>
         </CardContent>
       </Card>
 
       {/* View Documents Dialog */}
       <Dialog open={viewDialog.open} onOpenChange={(open) => setViewDialog({ open, verification: open ? viewDialog.verification : null })}>
         <DialogContent className="max-w-3xl">
           <DialogHeader>
             <DialogTitle>Documents d'identité</DialogTitle>
             <DialogDescription>
               Vérifiez que les documents sont valides et correspondent à l'utilisateur
             </DialogDescription>
           </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
              <div>
                <p className="text-sm font-medium mb-2">Pièce d'identité (Recto)</p>
                <div className="border rounded-lg overflow-hidden aspect-video bg-muted flex items-center justify-center">
                  <IdDocImage value={viewDialog.verification?.id_document_front} alt="ID Recto" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Pièce d'identité (Verso)</p>
                <div className="border rounded-lg overflow-hidden aspect-video bg-muted flex items-center justify-center">
                  <IdDocImage value={viewDialog.verification?.id_document_back} alt="ID Verso" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Selfie avec pièce</p>
                <div className="border rounded-lg overflow-hidden aspect-video bg-muted flex items-center justify-center">
                  <IdDocImage value={viewDialog.verification?.selfie_photo} alt="Selfie" />
                </div>
              </div>

           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setViewDialog({ open: false, verification: null })}>
               Fermer
             </Button>
             <Button 
               variant="default"
               onClick={() => viewDialog.verification && handleApprove(viewDialog.verification.id)}
             >
               <Check className="h-4 w-4 mr-1" />
               Approuver
             </Button>
             <Button 
               variant="destructive"
               onClick={() => {
                 if (viewDialog.verification) {
                   setRejectDialog({ open: true, verificationId: viewDialog.verification.id });
                   setViewDialog({ open: false, verification: null });
                 }
               }}
             >
               <X className="h-4 w-4 mr-1" />
               Refuser
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
 
       {/* Reject Dialog */}
       <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, verificationId: open ? rejectDialog.verificationId : null })}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Refuser la vérification</DialogTitle>
             <DialogDescription>Indiquez la raison du refus. L'utilisateur sera notifié.</DialogDescription>
           </DialogHeader>
           <Textarea
             placeholder="Documents illisibles, informations non concordantes..."
             value={rejectReason}
             onChange={(e) => setRejectReason(e.target.value)}
             rows={4}
           />
           <DialogFooter>
             <Button variant="outline" onClick={() => setRejectDialog({ open: false, verificationId: null })}>
               Annuler
             </Button>
             <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>
               Confirmer le refus
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 }