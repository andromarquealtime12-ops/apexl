import { useAverageRating } from "@/hooks/useReviews";
import { Star } from "lucide-react";

interface UserRatingBadgeProps {
  userId: string;
  compact?: boolean;
}

export default function UserRatingBadge({ userId, compact }: UserRatingBadgeProps) {
  const { data } = useAverageRating(userId);

  if (!data || data.count === 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs">
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        {data.average}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= Math.round(data.average)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/20"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {data.average} ({data.count})
      </span>
    </div>
  );
}
