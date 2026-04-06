import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ShoppingCart, ShoppingBag } from "lucide-react";
import { CartItemComponent } from "./CartItem";
import { Link } from "react-router-dom";
import { useState } from "react";

export function CartSheet() {
  const { items, getItemCount, getSubtotal, getDeliveryFee } = useCart();
  const [open, setOpen] = useState(false);
  const itemCount = getItemCount();
  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
            {itemCount}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Mon Panier ({itemCount})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">Votre panier est vide</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Ajoutez des produits pour commencer
            </p>
            <Button 
              variant="hero" 
              className="mt-4"
              onClick={() => setOpen(false)}
              asChild
            >
              <Link to="/products">Voir les produits</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4">
              {items.map((item) => (
                  <CartItemComponent key={item.id} item={item} />
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 sm:flex-col border-t pt-4">
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="font-medium">RD$ {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Livraison estimée</span>
                  <span className="font-medium">RD$ {deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">RD$ {(subtotal + deliveryFee).toLocaleString()}</span>
                </div>
              </div>
              <Button 
                variant="hero" 
                className="w-full" 
                size="lg"
                onClick={() => setOpen(false)}
                asChild
              >
                <Link to="/checkout">Passer la commande</Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
