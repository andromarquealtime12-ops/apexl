import { Product, CURRENCY_SYMBOLS } from "@/types/database";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Heart } from "lucide-react";
import { Link } from "react-router-dom";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const currencySymbol = CURRENCY_SYMBOLS[product.currency];
  const mainImage = product.images?.[0] || "/placeholder.svg";

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all">
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={mainImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 bg-primary">Vedette</Badge>
          )}
          {product.stock_quantity === 0 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              Épuisé
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
          >
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
        {product.category && (
          <p className="text-xs text-muted-foreground mt-1">{product.category.name}</p>
        )}
        <p className="text-lg font-bold text-primary mt-2">
          {currencySymbol} {product.price.toLocaleString()}
        </p>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full" 
          size="sm"
          disabled={product.stock_quantity === 0}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Ajouter au panier
        </Button>
      </CardFooter>
    </Card>
  );
}
