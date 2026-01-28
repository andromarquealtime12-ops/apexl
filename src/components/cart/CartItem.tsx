import { CartItem as CartItemType } from "@/contexts/CartContext";
import { CURRENCY_SYMBOLS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

interface CartItemProps {
  item: CartItemType;
}

export function CartItemComponent({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const { product, quantity } = item;
  const currencySymbol = CURRENCY_SYMBOLS[product.currency];
  const mainImage = product.images?.[0] || "/placeholder.svg";

  return (
    <div className="flex gap-3 py-3 border-b last:border-b-0">
      <img
        src={mainImage}
        alt={product.name}
        className="w-16 h-16 object-cover rounded-md bg-muted"
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm line-clamp-2">{product.name}</h4>
        <p className="text-primary font-semibold text-sm mt-1">
          {currencySymbol} {product.price.toLocaleString()}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateQuantity(product.id, quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium w-6 text-center">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateQuantity(product.id, quantity + 1)}
            disabled={quantity >= product.stock_quantity}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
            onClick={() => removeItem(product.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
