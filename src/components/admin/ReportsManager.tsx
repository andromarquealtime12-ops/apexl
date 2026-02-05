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
 import { AlertTriangle, Flag, Eye } from "lucide-react";
 import { useReports } from "@/hooks/useAdminAdvanced";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 
 export default function ReportsManager() {
   const [statusFilter, setStatusFilter] = useState("pending");
   const { data: reports, isLoading } = useReports(statusFilter);
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case "pending": return <Badge variant="destructive">En attente</Badge>;
       case "investigating": return <Badge className="bg-yellow-500">En investigation</Badge>;
       case "resolved": return <Badge className="bg-green-500">Résolu</Badge>;
       case "dismissed": return <Badge variant="secondary">Rejeté</Badge>;
       default: return <Badge variant="secondary">{status}</Badge>;
     }
   };
 
   const getCategoryLabel = (category: string) => {
     const labels: Record<string, string> = {
       fraud: "Fraude",
       harassment: "Harcèlement",
       inappropriate_content: "Contenu inapproprié",
       fake_product: "Produit faux",
       delivery_issue: "Problème livraison",
       other: "Autre"
     };
     return labels[category] || category;
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
               <Flag className="h-5 w-5" />
               Signalements
               {reports && reports.filter((r: any) => r.status === "pending").length > 0 && (
                 <Badge variant="destructive">
                   {reports.filter((r: any) => r.status === "pending").length}
                 </Badge>
               )}
             </CardTitle>
             <CardDescription>Gérez les signalements des utilisateurs</CardDescription>
           </div>
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="w-[150px]">
               <SelectValue placeholder="Statut" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Tous</SelectItem>
               <SelectItem value="pending">En attente</SelectItem>
               <SelectItem value="investigating">En investigation</SelectItem>
               <SelectItem value="resolved">Résolus</SelectItem>
               <SelectItem value="dismissed">Rejetés</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </CardHeader>
       <CardContent>
         {reports && reports.length > 0 ? (
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Catégorie</TableHead>
                 <TableHead>Description</TableHead>
                 <TableHead>Statut</TableHead>
                 <TableHead>Signalé le</TableHead>
                 <TableHead className="text-right">Actions</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {reports.map((report: any) => (
                 <TableRow key={report.id}>
                   <TableCell>
                     <Badge variant="outline">{getCategoryLabel(report.category)}</Badge>
                   </TableCell>
                   <TableCell className="max-w-[300px] truncate">
                     {report.description}
                   </TableCell>
                   <TableCell>{getStatusBadge(report.status)}</TableCell>
                   <TableCell className="text-sm">
                     {format(new Date(report.created_at), "dd/MM/yyyy", { locale: fr })}
                   </TableCell>
                   <TableCell className="text-right">
                     <Button variant="outline" size="sm">
                       <Eye className="h-4 w-4 mr-1" />
                       Examiner
                     </Button>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         ) : (
           <div className="text-center py-8 text-muted-foreground">
             <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
             <p>Aucun signalement trouvé</p>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }