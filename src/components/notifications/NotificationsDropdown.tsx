 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import { 
   Bell, Info, CheckCircle, AlertTriangle, 
   XCircle, Gift, ShoppingCart, Truck, Check
 } from "lucide-react";
 import { useNotifications, useUnreadNotificationsCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from "@/hooks/useNotifications";
 import { format } from "date-fns";
 import { fr } from "date-fns/locale";
 import { useNavigate } from "react-router-dom";
 
 export default function NotificationsDropdown() {
   const { data: notifications, isLoading } = useNotifications();
   const { data: unreadCount } = useUnreadNotificationsCount();
   const markAsRead = useMarkNotificationAsRead();
   const markAllAsRead = useMarkAllNotificationsAsRead();
   const navigate = useNavigate();
 
   const getIcon = (type: string) => {
     switch (type) {
       case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
       case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
       case "error": return <XCircle className="h-4 w-4 text-red-500" />;
       case "promo": return <Gift className="h-4 w-4 text-purple-500" />;
       case "order": return <ShoppingCart className="h-4 w-4 text-blue-500" />;
       case "delivery": return <Truck className="h-4 w-4 text-orange-500" />;
       default: return <Info className="h-4 w-4 text-muted-foreground" />;
     }
   };
 
   const handleNotificationClick = (notification: any) => {
     if (!notification.is_read) {
       markAsRead.mutate(notification.id);
     }
     if (notification.action_url) {
       navigate(notification.action_url);
     }
   };
 
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button variant="ghost" size="icon" className="relative">
           <Bell className="h-5 w-5" />
           {unreadCount && unreadCount > 0 && (
             <Badge 
               variant="destructive" 
               className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
             >
               {unreadCount > 9 ? "9+" : unreadCount}
             </Badge>
           )}
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="end" className="w-80">
         <DropdownMenuLabel className="flex items-center justify-between">
           <span>Notifications</span>
           {unreadCount && unreadCount > 0 && (
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-auto p-1 text-xs"
               onClick={() => markAllAsRead.mutate()}
             >
               <Check className="h-3 w-3 mr-1" />
               Tout marquer lu
             </Button>
           )}
         </DropdownMenuLabel>
         <DropdownMenuSeparator />
         <ScrollArea className="h-[300px]">
           {isLoading ? (
             <div className="p-4 text-center text-muted-foreground">Chargement...</div>
           ) : notifications && notifications.length > 0 ? (
             notifications.map((notification) => (
               <DropdownMenuItem
                 key={notification.id}
                 className={`flex items-start gap-3 p-3 cursor-pointer ${!notification.is_read ? "bg-muted/50" : ""}`}
                 onClick={() => handleNotificationClick(notification)}
               >
                 <div className="mt-0.5">{getIcon(notification.type)}</div>
                 <div className="flex-1 min-w-0">
                   <p className={`text-sm font-medium ${!notification.is_read ? "font-semibold" : ""}`}>
                     {notification.title}
                   </p>
                   <p className="text-xs text-muted-foreground truncate">
                     {notification.message}
                   </p>
                   <p className="text-xs text-muted-foreground mt-1">
                     {format(new Date(notification.created_at), "dd MMM à HH:mm", { locale: fr })}
                   </p>
                 </div>
                 {!notification.is_read && (
                   <div className="h-2 w-2 rounded-full bg-primary" />
                 )}
               </DropdownMenuItem>
             ))
           ) : (
             <div className="p-4 text-center text-muted-foreground">
               <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
               <p>Aucune notification</p>
             </div>
           )}
         </ScrollArea>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 }