 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 
 export interface Referral {
   id: string;
   referrer_id: string;
   referred_id: string;
   status: "pending" | "active" | "rewarded";
   reward_amount: number;
   orders_count: number;
   created_at: string;
 }
 
 export function useMyReferrals() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["my-referrals", user?.id],
     queryFn: async (): Promise<Referral[]> => {
       const { data, error } = await supabase
         .from("referrals")
         .select("*")
         .eq("referrer_id", user!.id)
         .order("created_at", { ascending: false });
       
       if (error) throw error;
       return data as Referral[];
     },
     enabled: !!user
   });
 }
 
 export function useReferralStats() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ["referral-stats", user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("referrals")
         .select("status, reward_amount")
         .eq("referrer_id", user!.id);
       
       if (error) throw error;
       
       const totalReferred = data?.length || 0;
       const activeReferrals = data?.filter(r => r.status === "active" || r.status === "rewarded").length || 0;
       const totalRewards = data?.reduce((sum, r) => sum + Number(r.reward_amount), 0) || 0;
       
       return { totalReferred, activeReferrals, totalRewards };
     },
     enabled: !!user
   });
 }
 
 export function useMyReferralCode() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const query = useQuery({
     queryKey: ["my-referral-code", user?.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("profiles")
         .select("referral_code")
         .eq("user_id", user!.id)
         .single();
       
       if (error) throw error;
       return data?.referral_code;
     },
     enabled: !!user
   });
 
   const generateCode = useMutation({
     mutationFn: async () => {
       // Generate a random 8-character code
       const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
       let code = "";
       for (let i = 0; i < 8; i++) {
         code += chars.charAt(Math.floor(Math.random() * chars.length));
       }
       
       const { error } = await supabase
         .from("profiles")
         .update({ referral_code: code })
         .eq("user_id", user!.id);
       
       if (error) throw error;
       return code;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["my-referral-code", user?.id] });
     }
   });
 
   return { ...query, generateCode };
 }