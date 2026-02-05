 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
   SheetTrigger,
 } from "@/components/ui/sheet";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from "@/components/ui/dialog";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { MessageCircle, Send, Plus, ArrowLeft } from "lucide-react";
 import { useAuth } from "@/contexts/AuthContext";
 import { 
   useUserSupportTickets, 
   useTicketMessages, 
   useCreateSupportTicket, 
   useSendSupportMessage 
 } from "@/hooks/useSupportChat";
 import { useToast } from "@/hooks/use-toast";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 
 export default function SupportChatWidget() {
   const { user } = useAuth();
   const { toast } = useToast();
   const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
   const [newTicketDialog, setNewTicketDialog] = useState(false);
   const [newTicket, setNewTicket] = useState({ subject: "", message: "", category: "general" });
   const [newMessage, setNewMessage] = useState("");
 
   const { data: tickets } = useUserSupportTickets();
   const { data: messages } = useTicketMessages(selectedTicketId || "");
   const createTicket = useCreateSupportTicket();
   const sendMessage = useSendSupportMessage();
 
   const handleCreateTicket = async () => {
     if (!newTicket.subject || !newTicket.message) return;
     
     try {
       const ticket = await createTicket.mutateAsync(newTicket);
       setNewTicketDialog(false);
       setNewTicket({ subject: "", message: "", category: "general" });
       setSelectedTicketId(ticket.id);
       toast({ title: "Ticket créé", description: "Notre équipe vous répondra bientôt." });
     } catch (error) {
       toast({ title: "Erreur", variant: "destructive" });
     }
   };
 
   const handleSendMessage = async () => {
     if (!newMessage || !selectedTicketId) return;
     
     try {
       await sendMessage.mutateAsync({ ticketId: selectedTicketId, message: newMessage });
       setNewMessage("");
     } catch (error) {
       toast({ title: "Erreur", variant: "destructive" });
     }
   };
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case "open": return <Badge className="bg-blue-500">Ouvert</Badge>;
       case "in_progress": return <Badge className="bg-yellow-500">En cours</Badge>;
       case "resolved": return <Badge className="bg-green-500">Résolu</Badge>;
       case "closed": return <Badge variant="secondary">Fermé</Badge>;
       default: return <Badge variant="secondary">{status}</Badge>;
     }
   };
 
   if (!user) return null;
 
   return (
     <>
       <Sheet>
         <SheetTrigger asChild>
           <Button
             className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
             size="icon"
           >
             <MessageCircle className="h-6 w-6" />
           </Button>
         </SheetTrigger>
         <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
           <SheetHeader>
             <SheetTitle className="flex items-center gap-2">
               {selectedTicketId && (
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-8 w-8"
                   onClick={() => setSelectedTicketId(null)}
                 >
                   <ArrowLeft className="h-4 w-4" />
                 </Button>
               )}
               Support Client
             </SheetTitle>
             <SheetDescription>
               {selectedTicketId ? "Conversation avec le support" : "Vos tickets de support"}
             </SheetDescription>
           </SheetHeader>
 
           {selectedTicketId ? (
             // Chat View
             <div className="flex-1 flex flex-col mt-4">
               <ScrollArea className="flex-1 pr-4">
                 <div className="space-y-4">
                   {messages?.map((msg) => (
                     <div
                       key={msg.id}
                       className={`flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}
                     >
                       <div
                         className={`max-w-[80%] rounded-lg p-3 ${
                           msg.sender_id === user.id
                             ? "bg-primary text-primary-foreground"
                             : "bg-muted"
                         }`}
                       >
                         <p className="text-sm">{msg.message}</p>
                         <p className={`text-xs mt-1 ${msg.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                           {format(new Date(msg.created_at), "HH:mm", { locale: fr })}
                         </p>
                       </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
               <div className="flex gap-2 mt-4">
                 <Input
                   placeholder="Écrivez votre message..."
                   value={newMessage}
                   onChange={(e) => setNewMessage(e.target.value)}
                   onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                 />
                 <Button onClick={handleSendMessage} disabled={!newMessage}>
                   <Send className="h-4 w-4" />
                 </Button>
               </div>
             </div>
           ) : (
             // Tickets List View
             <div className="flex-1 flex flex-col mt-4">
               <Button
                 className="mb-4"
                 onClick={() => setNewTicketDialog(true)}
               >
                 <Plus className="h-4 w-4 mr-2" />
                 Nouveau ticket
               </Button>
               <ScrollArea className="flex-1">
                 <div className="space-y-2">
                   {tickets && tickets.length > 0 ? (
                     tickets.map((ticket) => (
                       <div
                         key={ticket.id}
                         className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                         onClick={() => setSelectedTicketId(ticket.id)}
                       >
                         <div className="flex items-center justify-between mb-1">
                           <span className="font-medium text-sm truncate">{ticket.subject}</span>
                           {getStatusBadge(ticket.status)}
                         </div>
                         <p className="text-xs text-muted-foreground">
                           {format(new Date(ticket.created_at), "dd MMM yyyy", { locale: fr })}
                         </p>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-8 text-muted-foreground">
                       <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                       <p>Aucun ticket</p>
                       <p className="text-sm">Créez un ticket pour nous contacter</p>
                     </div>
                   )}
                 </div>
               </ScrollArea>
             </div>
           )}
         </SheetContent>
       </Sheet>
 
       {/* New Ticket Dialog */}
       <Dialog open={newTicketDialog} onOpenChange={setNewTicketDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Nouveau ticket de support</DialogTitle>
             <DialogDescription>Décrivez votre problème et notre équipe vous répondra rapidement.</DialogDescription>
           </DialogHeader>
           <div className="space-y-4 py-4">
             <div>
               <label className="text-sm font-medium">Catégorie</label>
               <Select 
                 value={newTicket.category} 
                 onValueChange={(v) => setNewTicket(t => ({ ...t, category: v }))}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="general">Général</SelectItem>
                   <SelectItem value="order">Commande</SelectItem>
                   <SelectItem value="payment">Paiement</SelectItem>
                   <SelectItem value="delivery">Livraison</SelectItem>
                   <SelectItem value="account">Compte</SelectItem>
                   <SelectItem value="technical">Technique</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <label className="text-sm font-medium">Sujet</label>
               <Input
                 placeholder="Résumé de votre demande"
                 value={newTicket.subject}
                 onChange={(e) => setNewTicket(t => ({ ...t, subject: e.target.value }))}
               />
             </div>
             <div>
               <label className="text-sm font-medium">Message</label>
               <Textarea
                 placeholder="Décrivez votre problème en détail..."
                 value={newTicket.message}
                 onChange={(e) => setNewTicket(t => ({ ...t, message: e.target.value }))}
                 rows={4}
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setNewTicketDialog(false)}>
               Annuler
             </Button>
             <Button onClick={handleCreateTicket} disabled={!newTicket.subject || !newTicket.message}>
               Envoyer
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 }