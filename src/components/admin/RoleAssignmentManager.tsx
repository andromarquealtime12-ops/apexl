import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserPlus, User, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithProfile {
  user_id: string;
  full_name: string;
  roles: AppRole[];
}

export default function RoleAssignmentManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users-with-roles"],
    queryFn: async (): Promise<UserWithProfile[]> => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      return profiles.map((profile) => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        roles: roles
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role as AppRole),
      }));
    },
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Rôle assigné avec succès");
      setDialogOpen(false);
      setSelectedUser(null);
      setSelectedRole("");
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Cet utilisateur a déjà ce rôle");
      } else {
        toast.error("Erreur lors de l'assignation du rôle");
      }
    },
  });

  const filteredUsers = users?.filter((user) =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case "admin":
        return "destructive";
      case "seller":
        return "default";
      case "driver":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "seller":
        return "Vendeur";
      case "driver":
        return "Livreur";
      case "buyer":
        return "Acheteur";
      default:
        return role;
    }
  };

  const handleAssignRole = () => {
    if (!selectedUser || !selectedRole) return;
    assignRole.mutate({ userId: selectedUser.user_id, role: selectedRole as AppRole });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Rôles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers?.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{user.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles.map((role) => (
                      <Badge key={role} variant={getRoleBadgeVariant(role)}>
                        {getRoleLabel(role)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog open={dialogOpen && selectedUser?.user_id === user.user_id} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                      setSelectedUser(null);
                      setSelectedRole("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Ajouter rôle
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assigner un rôle</DialogTitle>
                        <DialogDescription>
                          Ajouter un nouveau rôle à {user.full_name}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Rôles actuels</Label>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.map((role) => (
                              <Badge key={role} variant={getRoleBadgeVariant(role)}>
                                {getRoleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Nouveau rôle</Label>
                          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                              {!user.roles.includes("seller") && (
                                <SelectItem value="seller">Vendeur</SelectItem>
                              )}
                              {!user.roles.includes("driver") && (
                                <SelectItem value="driver">Livreur</SelectItem>
                              )}
                              {!user.roles.includes("admin") && (
                                <SelectItem value="admin">Admin</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleAssignRole} disabled={!selectedRole || assignRole.isPending}>
                          {assignRole.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Assigner"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(!filteredUsers || filteredUsers.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Aucun utilisateur trouvé</p>
        </div>
      )}
    </div>
  );
}
