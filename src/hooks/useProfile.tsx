import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Explicitly exclude sensitive fields: two_factor_secret, verification_code
const PROFILE_SAFE_COLUMNS = `
  id, user_id, full_name, phone, avatar_url, country, address, city,
  email_verified, phone_verified, verification_code_expires_at,
  latitude, longitude, created_at, updated_at,
  identity_status, account_status, trust_score, referral_code,
  total_spent, total_earned, report_count, lost_packages_count,
  referred_by, two_factor_enabled, last_login_at,
  backup_email, backup_phone, suspension_reason, suspension_until,
  admin_notes, id_document_front, id_document_back, selfie_photo,
  last_login_ip, last_login_device, phone_verified
`;

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  address: string | null;
  city: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  date_of_birth: string | null;
  personal_info_locked: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase.rpc("get_my_profile");

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Profile | null;
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useIsEmailVerified() {
  const { data: profile, isLoading } = useProfile();
  
  return {
    isVerified: profile?.email_verified ?? false,
    isLoading,
  };
}
