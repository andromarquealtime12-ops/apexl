import { Product, CURRENCY_SYMBOLS } from "@/types/database";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const currencySymbol = CURRENCY_SYMBOLS[product.currency];
  const mainImage = product.images?.[0] || "/placeholder.svg";
  const hasVariants = Boolean(product.available_colors?.length || product.available_sizes?.length);

  const isInCart = items.some((item) => item.product.id === product.id);

  // Shopify / Printful product geographic availability
  const isShopify = (product as any).is_shopify === true;
  const isPrintful = (product as any).is_printful === true;
  const availableCountries: string[] = (product as any).available_countries || ['DO', 'HT'];
  const userCountry = (typeof navigator !== 'undefined' && navigator.language?.includes('HT')) ? 'HT' : 'DO';
  const outOfCountry = isShopify && availableCountries.length > 0 && !availableCountries.includes(userCountry);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfCountry) return;
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all">
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-none shadow-sm" />
          
          {product.is_featured &&
          <Badge className="absolute top-2 left-2 bg-primary">Vedette</Badge>
          }
          {isShopify &&
          <Badge variant="secondary" className="absolute top-2 left-2 mt-8">Shopify</Badge>
          }
          {isPrintful &&
          <Badge variant="secondary" className="absolute top-2 left-2 mt-8">Printful · POD</Badge>
          }
          {outOfCountry &&
          <Badge variant="destructive" className="absolute bottom-2 left-2">Hors pays</Badge>
          }
          {product.stock_quantity === 0 &&
          <Badge variant="destructive" className="absolute top-2 right-2">
              Épuisé
            </Badge>
          }
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}>
            
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </Link>

      <CardContent className="p-4">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.category &&
        <p className="text-xs text-muted-foreground mt-1">{product.category.name}</p>
        }
        <p className="text-lg font-bold text-primary mt-2">
          {currencySymbol} {product.price.toLocaleString()}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {hasVariants ? (
          <Button className="w-full" size="sm" asChild>
            <Link to={`/product/${product.id}`}>Choisir couleur / taille</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            size="sm"
            disabled={product.stock_quantity === 0 || outOfCountry}
            variant={added || isInCart ? "secondary" : "default"}
            onClick={handleAddToCart}>
            
            {outOfCountry ?
            <>Indisponible dans votre pays</> :
            added ?
            <>
                <Check className="h-4 w-4 mr-2" />
                Ajouté !
              </> :
            isInCart ?
            <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Dans le panier
              </> :

            <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ajouter au panier
              </>
            }
          </Button>
        )}
      </CardFooter>
    </Card>);

}