 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { useEffect } from "react";
 
 export interface Notification {
   id: string;
   user_id: string;
   title: string;
   message: string;
   type: "info" | "success" | "warning" | "error" | "promo" | "order" | "delivery";
   is_read: boolean;
   action_url: string | null;
   created_at: string;
 }
 
 export function useNotifications() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const query = useQuery({
     queryKey: ["notifications", user?.id],
     queryFn: async (): Promise<Notification[]> => {
       const { data, error } = await supabase
         .from("notifications")
         .select("*")
         .eq("user_id", user!.id)
         .order("created_at", { ascending: false })
         .limit(50);
       
       if (error) throw error;
       return data as Notification[];
     },
     enabled: !!user
   });
 
   // Real-time subscription
   useEffect(() => {
     if (!user) return;
 
     const channel = supabase
       .channel(`notifications-${user.id}`)
       .on(
         "postgres_changes",
         {
           event: "INSERT",
           schema: "public",
           table: "notifications",
           filter: `user_id=eq.${user.id}`
         },
         () => {
           queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [user, queryClient]);
 
   return query;
 }
 
 export function useUnreadNotificationsCount() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["notifications-unread-count", user?.id],
     queryFn: async () => {
       const { count, error } = await supabase
         .from("notifications")
         .select("id", { count: "exact", head: true })
         .eq("user_id", user!.id)
         .eq("is_read", false);
       
       if (error) throw error;
       return count || 0;
     },
     enabled: !!user,
     refetchInterval: 30000
   });
 }
 
 export function useMarkNotificationAsRead() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (notificationId: string) => {
       const { error } = await supabase
         .from("notifications")
         .update({ is_read: true })
         .eq("id", notificationId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
       queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", user?.id] });
     }
   });
 }
 
 export function useMarkAllNotificationsAsRead() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async () => {
       const { error } = await supabase
         .from("notifications")
         .update({ is_read: true })
         .eq("user_id", user!.id)
         .eq("is_read", false);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
       queryClient.invalidateQueries({ queryKey: ["notifications-unread-count", user?.id] });
     }
   });
 }