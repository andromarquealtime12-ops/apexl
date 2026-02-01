import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers, useRevokeAdminRole } from "@/hooks/useAdminUsers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, ShieldOff, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminUsersManager() {
  const { user } = useAuth();
  const { data: adminUsers, isLoading } = useAdminUsers();
  const revokeAdmin = useRevokeAdminRole();
  const [userToRevoke, setUserToRevoke] = useState<{ id: string; name: string } | null>(null);

  const handleRevoke = async () => {
    if (!userToRevoke) return;

    try {
      await revokeAdmin.mutateAsync(userToRevoke.id);
      toast.success(`Accès admin révoqué pour ${userToRevoke.name}`);
      setUserToRevoke(null);
    } catch (error) {
      toast.error("Erreur lors de la révocation");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!adminUsers || adminUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Aucun administrateur trouvé</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>{adminUsers.length} administrateur(s)</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Rôles</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {adminUsers.map((adminUser) => {
            const isCurrentUser = adminUser.userId === user?.id;
            
            return (
              <TableRow key={adminUser.userId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{adminUser.fullName}</span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">Vous</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {adminUser.roles.map((role) => (
                      <Badge key={role} variant={getRoleBadgeVariant(role)}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUserToRevoke({ id: adminUser.userId, name: adminUser.fullName })}
                    disabled={isCurrentUser || revokeAdmin.isPending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <ShieldOff className="h-4 w-4 mr-1" />
                    Révoquer
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!userToRevoke} onOpenChange={() => setUserToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'accès admin ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir révoquer les droits administrateur de{" "}
              <strong>{userToRevoke?.name}</strong> ? Cette action peut être annulée en
              utilisant un nouveau code admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Révoquer l'accès
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
