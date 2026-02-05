 import { useState } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { 
   Select, SelectContent, SelectItem, 
   SelectTrigger, SelectValue 
 } from "@/components/ui/select";
 import { 
   Table, TableBody, TableCell, TableHead, 
   TableHeader, TableRow 
 } from "@/components/ui/table";
 import { Skeleton } from "@/components/ui/skeleton";
 import { MessageSquare, Clock, CheckCircle, XCircle } from "lucide-react";
 import { useSupportTickets } from "@/hooks/useAdminAdvanced";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 
 export default function SupportTicketsManager() {
   const [statusFilter, setStatusFilter] = useState("all");
   const { data: tickets, isLoading } = useSupportTickets(statusFilter);
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case "open": return <Badge className="bg-blue-500">Ouvert</Badge>;
       case "in_progress": return <Badge className="bg-yellow-500">En cours</Badge>;
       case "resolved": return <Badge className="bg-green-500">Résolu</Badge>;
       case "closed": return <Badge variant="secondary">Fermé</Badge>;
       default: return <Badge variant="secondary">{status}</Badge>;
     }
   };
 
   const getPriorityBadge = (priority: string) => {
     switch (priority) {
       case "urgent": return <Badge variant="destructive">Urgent</Badge>;
       case "high": return <Badge className="bg-orange-500">Haute</Badge>;
       case "normal": return <Badge variant="secondary">Normal</Badge>;
       case "low": return <Badge variant="outline">Basse</Badge>;
       default: return <Badge variant="secondary">{priority}</Badge>;
     }
   };
 
   if (isLoading) {
     return <Skeleton className="h-64 w-full" />;
   }
 
   return (
     <Card>
       <CardHeader>
         <div className="flex items-center justify-between">
           <div>
             <CardTitle className="flex items-center gap-2">
               <MessageSquare className="h-5 w-5" />
               Tickets Support
             </CardTitle>
             <CardDescription>Gérez les demandes d'assistance des utilisateurs</CardDescription>
           </div>
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="w-[150px]">
               <SelectValue placeholder="Statut" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Tous</SelectItem>
               <SelectItem value="open">Ouverts</SelectItem>
               <SelectItem value="in_progress">En cours</SelectItem>
               <SelectItem value="resolved">Résolus</SelectItem>
               <SelectItem value="closed">Fermés</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </CardHeader>
       <CardContent>
         {tickets && tickets.length > 0 ? (
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Sujet</TableHead>
                 <TableHead>Catégorie</TableHead>
                 <TableHead>Priorité</TableHead>
                 <TableHead>Statut</TableHead>
                 <TableHead>Créé le</TableHead>
                 <TableHead className="text-right">Actions</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {tickets.map((ticket: any) => (
                 <TableRow key={ticket.id}>
                   <TableCell className="font-medium max-w-[200px] truncate">
                     {ticket.subject}
                   </TableCell>
                   <TableCell>{ticket.category || "Général"}</TableCell>
                   <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                   <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                   <TableCell className="text-sm">
                     {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                   </TableCell>
                   <TableCell className="text-right">
                     <Button variant="outline" size="sm">
                       Voir
                     </Button>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         ) : (
           <div className="text-center py-8 text-muted-foreground">
             <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
             <p>Aucun ticket trouvé</p>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }