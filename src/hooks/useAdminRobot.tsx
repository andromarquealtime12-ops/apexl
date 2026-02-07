import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RobotSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RobotLog {
  id: string;
  action_type: string;
  target_id: string;
  target_type: string;
  details: Record<string, any>;
  status: string;
  created_at: string;
}

export function useRobotSettings() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["robot-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_robot_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      return data as RobotSetting[];
    },
    enabled: isAdmin,
  });
}

export function useRobotLogs(limit = 50) {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ["robot-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_robot_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as RobotLog[];
    },
    enabled: isAdmin,
  });
}

export function useUpdateRobotSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ settingKey, isEnabled, settingValue }: { 
      settingKey: string; 
      isEnabled?: boolean;
      settingValue?: Record<string, any>;
    }) => {
      const updates: Partial<RobotSetting> = { updated_at: new Date().toISOString() };
      if (isEnabled !== undefined) updates.is_enabled = isEnabled;
      if (settingValue !== undefined) updates.setting_value = settingValue;

      const { error } = await supabase
        .from("admin_robot_settings")
        .update(updates)
        .eq("setting_key", settingKey);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robot-settings"] });
    },
  });
}

export function useRunAdminRobot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("run_admin_robot" as any);
      if (error) throw error;
      return data as {
        success: boolean;
        deposits_processed: number;
        identities_processed: number;
        sellers_processed: number;
        drivers_processed: number;
        total: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robot-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-seller-applications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-driver-applications"] });
    },
  });
}
