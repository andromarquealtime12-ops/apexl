import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminUser {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Group roles by user
      const userRolesMap = new Map<string, string[]>();
      rolesData?.forEach((r) => {
        const existing = userRolesMap.get(r.user_id) || [];
        existing.push(r.role);
        userRolesMap.set(r.user_id, existing);
      });

      // Build admin users list (users with admin role)
      const adminUsers: AdminUser[] = [];
      userRolesMap.forEach((roles, userId) => {
        if (roles.includes("admin")) {
          const profile = profilesData?.find((p) => p.user_id === userId);
          adminUsers.push({
            userId,
            email: "", // We'll show the name instead
            fullName: profile?.full_name || "Utilisateur",
            roles,
          });
        }
      });

      return adminUsers;
    },
  });
}

export function useRevokeAdminRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
