import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { useCreateReview } from "@/hooks/useReviews";
import { toast } from "sonner";

interface OrderRatingDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  reviewedUserId: string;
  reviewType: "buyer_to_seller" | "buyer_to_driver";
  userName?: string;
}

export default function OrderRatingDialog({ open, onClose, orderId, reviewedUserId, reviewType, userName }: OrderRatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const createReview = useCreateReview();

  const label = reviewType === "buyer_to_seller" ? "vendeur" : "livreur";

  const handleSubmit = async () => {
    if (rating === 0) return;
    try {
      await createReview.mutateAsync({
        orderId,
        reviewedUserId,
        rating,
        comment,
        reviewType,
      });
      toast.success("Merci pour votre évaluation !");
      onClose();
      setRating(0);
      setComment("");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'envoi");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⭐ Évaluer le {label}</DialogTitle>
          <DialogDescription>
            {userName ? `Comment était votre expérience avec ${userName} ?` : `Notez votre expérience avec ce ${label}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-transform hover:scale-110"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 1 && "Très mauvais"}
            {rating === 2 && "Mauvais"}
            {rating === 3 && "Correct"}
            {rating === 4 && "Bien"}
            {rating === 5 && "Excellent !"}
          </p>

          <Textarea
            placeholder="Commentaire (optionnel)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />

          <Button
            className="w-full"
            disabled={rating === 0 || createReview.isPending}
            onClick={handleSubmit}
          >
            {createReview.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Envoyer l'évaluation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
