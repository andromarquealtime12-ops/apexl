 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 
export interface AdvancedUserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  identity_status: string;
  account_status: string;
  trust_score: number;
  total_spent: number;
  total_earned: number;
  email_verified: boolean;
  created_at: string;
  suspension_reason: string | null;
  suspension_until: string | null;
  admin_notes: string | null;
  roles: string[];
  report_count: number;
  lost_packages_count: number;
  id_document_front: string | null;
  id_document_back: string | null;
  selfie_photo: string | null;
  wallet_frozen?: boolean;
  wallet_balance_dop?: number;
  wallet_balance_htg?: number;
  wallet_balance_usd?: number;
  email?: string;
  last_login_at?: string | null;
  referral_code?: string | null;
}
 
 export function useAdminAdvancedStats() {
   const { isAdmin } = useAuth();
 
   return useQuery({
     queryKey: ["admin-advanced-stats"],
     queryFn: async () => {
       const now = new Date();
       const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
       const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
       const today = new Date().toISOString().split('T')[0];
 
       const [
         usersResult,
         rolesResult,
         revenueResult,
         ordersToday,
         ordersInProgress,
         newUsersThisWeek,
         newUsersLastWeek,
         pendingVerifications,
         openTickets
       ] = await Promise.all([
         supabase.from("profiles").select("id", { count: "exact", head: true }),
         supabase.from("user_roles").select("role"),
         supabase.from("wallet_transactions")
           .select("amount")
           .eq("status", "completed")
           .gte("created_at", thirtyDaysAgo.toISOString()),
         supabase.from("orders")
           .select("id", { count: "exact", head: true })
           .gte("created_at", today),
         supabase.from("orders")
           .select("id", { count: "exact", head: true })
           .in("status", ["confirmed", "ready", "picked_up"]),
         supabase.from("profiles")
           .select("id", { count: "exact", head: true })
           .gte("created_at", sevenDaysAgo.toISOString()),
         supabase.from("profiles")
           .select("id", { count: "exact", head: true })
           .gte("created_at", new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
           .lt("created_at", sevenDaysAgo.toISOString()),
         supabase.from("identity_verifications")
           .select("id", { count: "exact", head: true })
           .eq("status", "pending"),
         supabase.from("support_tickets")
           .select("id", { count: "exact", head: true })
           .in("status", ["open", "in_progress"])
       ]);
 
       const totalRevenue = (revenueResult.data || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
       
       const buyersCount = (rolesResult.data || []).filter(r => r.role === "buyer").length;
       const sellersCount = (rolesResult.data || []).filter(r => r.role === "seller").length;
       const driversCount = (rolesResult.data || []).filter(r => r.role === "driver").length;
 
       const growth = newUsersLastWeek.count && newUsersLastWeek.count > 0
         ? ((newUsersThisWeek.count || 0) - newUsersLastWeek.count) / newUsersLastWeek.count * 100
         : 100;
 
       return {
         totalUsers: usersResult.count || 0,
         buyersCount,
         sellersCount,
         driversCount,
         totalRevenue,
         ordersToday: ordersToday.count || 0,
         ordersInProgress: ordersInProgress.count || 0,
         userGrowth: Math.round(growth),
         pendingVerifications: pendingVerifications.count || 0,
         openTickets: openTickets.count || 0
       };
     },
     enabled: isAdmin,
     refetchInterval: 30000
   });
 }
 
export function useAdminUsers(filters?: { role?: string; status?: string; search?: string }) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["admin-users-list", filters],
    queryFn: async (): Promise<AdvancedUserProfile[]> => {
      let query = supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("account_status", filters.status);
      }

      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      // Get roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const userRolesMap = new Map<string, string[]>();
      rolesData?.forEach(r => {
        const existing = userRolesMap.get(r.user_id) || [];
        existing.push(r.role);
        userRolesMap.set(r.user_id, existing);
      });

      // Get wallets for frozen status and balances
      const { data: walletsData } = await supabase
        .from("wallets")
        .select("user_id, is_frozen, balance_dop, balance_htg, balance_usd");

      const walletsMap = new Map<string, { frozen: boolean; dop: number; htg: number; usd: number }>();
      walletsData?.forEach(w => {
        walletsMap.set(w.user_id, {
          frozen: w.is_frozen || false,
          dop: w.balance_dop || 0,
          htg: w.balance_htg || 0,
          usd: w.balance_usd || 0
        });
      });

      let result = (profiles || []).map(p => ({
        ...p,
        roles: userRolesMap.get(p.user_id) || ["buyer"],
        wallet_frozen: walletsMap.get(p.user_id)?.frozen || false,
        wallet_balance_dop: walletsMap.get(p.user_id)?.dop || 0,
        wallet_balance_htg: walletsMap.get(p.user_id)?.htg || 0,
        wallet_balance_usd: walletsMap.get(p.user_id)?.usd || 0
      }));

      if (filters?.role && filters.role !== "all") {
        result = result.filter(u => u.roles.includes(filters.role!));
      }

      return result;
    },
    enabled: isAdmin
  });
}
 
 export function useSuspendUser() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ userId, reason, durationDays }: { userId: string; reason: string; durationDays: number | null }) => {
       const { data, error } = await supabase.rpc("suspend_user", {
         p_user_id: userId,
         p_reason: reason,
         p_duration_days: durationDays
       });
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
       queryClient.invalidateQueries({ queryKey: ["admin-advanced-stats"] });
     }
   });
 }
 
 export function useActivateUser() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (userId: string) => {
       const { data, error } = await supabase.rpc("activate_user", {
         p_user_id: userId
       });
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
     }
   });
 }
 
 export function useUpdateAdminNotes() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ userId, notes }: { userId: string; notes: string }) => {
       const { error } = await supabase
         .from("profiles")
         .update({ admin_notes: notes })
         .eq("user_id", userId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
     }
   });
 }
 
 export function usePendingIdentityVerifications() {
   const { isAdmin } = useAuth();
 
   return useQuery({
     queryKey: ["pending-identity-verifications"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("identity_verifications")
         .select("*, profiles!identity_verifications_user_id_fkey(full_name)")
         .eq("status", "pending")
         .order("created_at", { ascending: true });
       if (error) throw error;
       return data;
     },
     enabled: isAdmin
   });
 }
 
 export function useApproveIdentityVerification() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ verificationId, comment }: { verificationId: string; comment?: string }) => {
       const { data, error } = await supabase.rpc("approve_identity_verification", {
         p_verification_id: verificationId,
         p_comment: comment || null
       });
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["pending-identity-verifications"] });
       queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
       queryClient.invalidateQueries({ queryKey: ["admin-advanced-stats"] });
     }
   });
 }
 
 export function useRejectIdentityVerification() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ verificationId, reason }: { verificationId: string; reason: string }) => {
       const { data, error } = await supabase.rpc("reject_identity_verification", {
         p_verification_id: verificationId,
         p_reason: reason
       });
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["pending-identity-verifications"] });
       queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
     }
   });
 }
 
 export function useSupportTickets(status?: string) {
   const { isAdmin } = useAuth();
 
   return useQuery({
     queryKey: ["support-tickets", status],
     queryFn: async () => {
       let query = supabase
         .from("support_tickets")
         .select("*")
         .order("created_at", { ascending: false });
 
       if (status && status !== "all") {
         query = query.eq("status", status);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data;
     },
     enabled: isAdmin
   });
 }
 
 export function useReports(status?: string) {
   const { isAdmin } = useAuth();
 
   return useQuery({
     queryKey: ["admin-reports", status],
     queryFn: async () => {
       let query = supabase
         .from("reports")
         .select("*")
         .order("created_at", { ascending: false });
 
       if (status && status !== "all") {
         query = query.eq("status", status);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data;
     },
     enabled: isAdmin
   });
 }
 
 export function useAuditLogs() {
   const { isAdmin } = useAuth();
 
   return useQuery({
     queryKey: ["audit-logs"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("admin_audit_logs")
         .select("*")
         .order("created_at", { ascending: false })
         .limit(100);
       if (error) throw error;
       return data;
     },
     enabled: isAdmin
   });
 }
 
 export function usePlatformSettings() {
   return useQuery({
     queryKey: ["platform-settings"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("platform_settings")
         .select("*");
       if (error) throw error;
       
       const settings: Record<string, string> = {};
       data?.forEach(s => {
         settings[s.key] = s.value;
       });
       return settings;
     }
   });
 }
 
 export function useUpdatePlatformSetting() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ key, value }: { key: string; value: string }) => {
       const { error } = await supabase
         .from("platform_settings")
         .upsert({ key, value, updated_at: new Date().toISOString() });
       if (error) throw error;
     },
     onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    }
  });
}

export function useFreezeWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("freeze_wallet" as any, {
        p_user_id: userId,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    }
  });
}

export function useUnfreezeWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("unfreeze_wallet" as any, {
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
    }
  });
}

export function useAllIdentityVerifications() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["all-identity-verifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin
  });
}

export function useAllTransactions() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["all-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*, wallets(user_id)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("delete_user_account" as any, {
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-advanced-stats"] });
    }
  });
}

export function useUserTransactions(userId: string | null) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["user-transactions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!wallet) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !!userId
  });
}

export function useApproveWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase.rpc("approve_withdrawal" as any, {
        p_transaction_id: transactionId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions"] });
    }
  });
}

export function useRejectWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("reject_withdrawal" as any, {
        p_transaction_id: transactionId,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions"] });
    }
  });
}