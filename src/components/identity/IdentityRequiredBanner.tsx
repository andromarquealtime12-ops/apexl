import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

interface Props {
  role: "seller" | "driver";
}

/**
 * Mode limité — while identity isn't verified, sellers/drivers can browse
 * but should be nudged to complete verification. Blocking is enforced elsewhere;
 * this is the visible reminder.
 */
export function IdentityRequiredBanner({ role }: Props) {
  const { data: profile } = useProfile();
  const status = ((profile as any)?.identity_status || "unverified") as string;

  if (status === "verified") return null;

  const isDriver = role === "driver";
  const requirements = isDriver
    ? "pièce d'identité (recto/verso), permis de conduire moto, carte grise, et selfie"
    : "pièce d'identité (recto/verso) et selfie tenant votre pièce";

  if (status === "pending") {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20">
        <Clock className="h-4 w-4 text-yellow-600" />
        <AlertTitle>Vérification en cours</AlertTitle>
        <AlertDescription>
          Votre identité est en cours d'examen. Vous êtes en <b>mode limité</b> — accès complet dès
          l'approbation (24–48h).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
      <ShieldAlert className="h-4 w-4 text-amber-600" />
      <AlertTitle>
        Vérification d'identité requise — {isDriver ? "livreur" : "vendeur"}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Vous êtes en <b>mode limité</b>. Pour {isDriver ? "accepter des livraisons" : "encaisser vos ventes"},
          soumettez vos documents : {requirements}.
        </p>
        <Button asChild size="sm" variant="default">
          <Link to="/profile">
            <ShieldCheck className="h-4 w-4 mr-1" /> Vérifier mon identité
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
