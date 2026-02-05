 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Skeleton } from "@/components/ui/skeleton";
 import { History, User, Package, ShoppingCart, Wallet, Flag, Settings } from "lucide-react";
 import { useAuditLogs } from "@/hooks/useAdminAdvanced";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 
 export default function AuditLogsViewer() {
   const { data: logs, isLoading } = useAuditLogs();
 
   const getIcon = (targetType: string) => {
     switch (targetType) {
       case "user": return <User className="h-4 w-4" />;
       case "product": return <Package className="h-4 w-4" />;
       case "order": return <ShoppingCart className="h-4 w-4" />;
       case "transaction": return <Wallet className="h-4 w-4" />;
       case "report": return <Flag className="h-4 w-4" />;
       case "setting": return <Settings className="h-4 w-4" />;
       default: return <History className="h-4 w-4" />;
     }
   };
 
   const getActionLabel = (action: string) => {
     const labels: Record<string, string> = {
       suspend_user: "Suspension utilisateur",
       activate_user: "Réactivation utilisateur",
       approve_verification: "Approbation identité",
       reject_verification: "Refus identité",
       approve_deposit: "Approbation dépôt",
       reject_deposit: "Refus dépôt",
       update_setting: "Modification paramètre"
     };
     return labels[action] || action;
   };
 
   if (isLoading) {
     return <Skeleton className="h-64 w-full" />;
   }
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <History className="h-5 w-5" />
           Journal d'audit
         </CardTitle>
         <CardDescription>Historique des actions administratives</CardDescription>
       </CardHeader>
       <CardContent>
         {logs && logs.length > 0 ? (
           <ScrollArea className="h-[400px]">
             <div className="space-y-3">
               {logs.map((log: any) => (
                 <div 
                   key={log.id} 
                   className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                 >
                   <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center">
                     {getIcon(log.target_type)}
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2">
                       <span className="font-medium">{getActionLabel(log.action)}</span>
                       {log.target_type && (
                         <Badge variant="outline" className="text-xs">
                           {log.target_type}
                         </Badge>
                       )}
                     </div>
                     <p className="text-sm text-muted-foreground">
                       {format(new Date(log.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                     </p>
                     {log.new_value && (
                       <pre className="text-xs bg-background p-2 rounded mt-2 overflow-x-auto">
                         {JSON.stringify(log.new_value, null, 2)}
                       </pre>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           </ScrollArea>
         ) : (
           <div className="text-center py-8 text-muted-foreground">
             <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
             <p>Aucune action enregistrée</p>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }