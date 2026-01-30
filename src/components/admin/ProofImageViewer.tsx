import { useProofImageUrl } from "@/hooks/useAdminWallet";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ImageOff } from "lucide-react";

interface ProofImageViewerProps {
  proofPath: string;
}

export default function ProofImageViewer({ proofPath }: ProofImageViewerProps) {
  const { data: imageUrl, isLoading, error } = useProofImageUrl(proofPath);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Skeleton className="w-full h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <ImageOff className="h-12 w-12 mb-2" />
        <p>Impossible de charger l'image</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <img 
        src={imageUrl} 
        alt="Preuve de transaction" 
        className="max-w-full max-h-[60vh] rounded-lg object-contain border"
      />
    </div>
  );
}
