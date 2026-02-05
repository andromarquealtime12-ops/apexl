 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { useEffect } from "react";
 
 export interface SupportTicket {
   id: string;
   user_id: string;
   subject: string;
   status: "open" | "in_progress" | "resolved" | "closed";
   priority: "low" | "normal" | "high" | "urgent";
   category: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface SupportMessage {
   id: string;
   ticket_id: string;
   sender_id: string;
   message: string;
   is_admin_reply: boolean;
   created_at: string;
 }
 
 export function useUserSupportTickets() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["user-support-tickets", user?.id],
     queryFn: async (): Promise<SupportTicket[]> => {
       const { data, error } = await supabase
         .from("support_tickets")
         .select("*")
         .eq("user_id", user!.id)
         .order("created_at", { ascending: false });
       
       if (error) throw error;
       return data as SupportTicket[];
     },
     enabled: !!user
   });
 }
 
 export function useTicketMessages(ticketId: string) {
   const queryClient = useQueryClient();
 
   const query = useQuery({
     queryKey: ["support-messages", ticketId],
     queryFn: async (): Promise<SupportMessage[]> => {
       const { data, error } = await supabase
         .from("support_messages")
         .select("*")
         .eq("ticket_id", ticketId)
         .order("created_at", { ascending: true });
       
       if (error) throw error;
       return data as SupportMessage[];
     },
     enabled: !!ticketId
   });
 
   // Real-time subscription for new messages
   useEffect(() => {
     if (!ticketId) return;
 
     const channel = supabase
       .channel(`support-messages-${ticketId}`)
       .on(
         "postgres_changes",
         {
           event: "INSERT",
           schema: "public",
           table: "support_messages",
           filter: `ticket_id=eq.${ticketId}`
         },
         () => {
           queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [ticketId, queryClient]);
 
   return query;
 }
 
 export function useCreateSupportTicket() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async ({ subject, message, category }: { subject: string; message: string; category?: string }) => {
       // Create ticket
       const { data: ticket, error: ticketError } = await supabase
         .from("support_tickets")
         .insert({
           user_id: user!.id,
           subject,
           category: category || "general"
         })
         .select()
         .single();
       
       if (ticketError) throw ticketError;
 
       // Create first message
       const { error: messageError } = await supabase
         .from("support_messages")
         .insert({
           ticket_id: ticket.id,
           sender_id: user!.id,
           message,
           is_admin_reply: false
         });
       
       if (messageError) throw messageError;
 
       return ticket;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["user-support-tickets", user?.id] });
     }
   });
 }
 
 export function useSendSupportMessage() {
   const queryClient = useQueryClient();
   const { user, isAdmin } = useAuth();
 
   return useMutation({
     mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
       const { error } = await supabase
         .from("support_messages")
         .insert({
           ticket_id: ticketId,
           sender_id: user!.id,
           message,
           is_admin_reply: isAdmin
         });
       
       if (error) throw error;
     },
     onSuccess: (_, { ticketId }) => {
       queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
     }
   });
 }