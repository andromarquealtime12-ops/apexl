import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Copy, Key } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useAdminCodes,
  useCreateAdminCode,
  useDeleteAdminCode,
  useToggleAdminCode,
} from "@/hooks/useAdminCodes";

export default function AdminCodesManager() {
  const { data: codes, isLoading } = useAdminCodes();
  const createCode = useCreateAdminCode();
  const deleteCode = useDeleteAdminCode();
  const toggleCode = useToggleAdminCode();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [usesRemaining, setUsesRemaining] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("30");

  const handleCreate = async () => {
    await createCode.mutateAsync({
      usesRemaining: parseInt(usesRemaining) || 1,
      expiresInDays: parseInt(expiresInDays) || undefined,
    });
    setIsDialogOpen(false);
    setUsesRemaining("1");
    setExpiresInDays("30");
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Codes d'accès Admin</h3>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Générer un nouveau code admin</DialogTitle>
              <DialogDescription>
                Ce code permettra à un utilisateur d'obtenir les droits administrateur
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="uses">Nombre d'utilisations</Label>
                <Input
                  id="uses"
                  type="number"
                  min="1"
                  value={usesRemaining}
                  onChange={(e) => setUsesRemaining(e.target.value)}
                  placeholder="1"
                />
                <p className="text-xs text-muted-foreground">
                  Combien de fois ce code peut être utilisé
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Expire dans (jours)</Label>
                <Input
                  id="expires"
                  type="number"
                  min="1"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour un code sans expiration
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={createCode.isPending}>
                {createCode.isPending ? "Création..." : "Créer le code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {codes && codes.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Utilisations</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {code.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(code.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={code.is_active}
                        onCheckedChange={(checked) =>
                          toggleCode.mutate({ codeId: code.id, isActive: checked })
                        }
                      />
                      <Badge variant={code.is_active ? "default" : "secondary"}>
                        {code.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {code.uses_remaining !== null ? (
                      <span className={code.uses_remaining === 0 ? "text-destructive" : ""}>
                        {code.uses_remaining} restante(s)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Illimité</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {code.expires_at ? (
                      <span
                        className={
                          new Date(code.expires_at) < new Date()
                            ? "text-destructive"
                            : ""
                        }
                      >
                        {format(new Date(code.expires_at), "dd MMM yyyy", {
                          locale: fr,
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Jamais</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(code.created_at), "dd MMM yyyy", {
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCode.mutate(code.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Aucun code d'accès créé</p>
          <p className="text-sm">Créez votre premier code pour inviter des administrateurs</p>
        </div>
      )}
    </div>
  );
}
