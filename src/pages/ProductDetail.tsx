import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { ProductCard } from "@/components/ProductCard";
import { useCart } from "@/contexts/CartContext";
import { CURRENCY_SYMBOLS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Store, ArrowLeft, Plus, Minus, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const { data: product, isLoading } = useProduct(productId || "");
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");

  // Get seller info
  const { data: seller } = useQuery({
    queryKey: ["seller-profile", product?.seller_id],
    queryFn: async () => {
      if (!product?.seller_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, city")
        .eq("user_id", product.seller_id)
        .maybeSingle();
      return data;
    },
    enabled: !!product?.seller_id,
  });

  // Get seller's shop info
  const { data: shop } = useQuery({
    queryKey: ["seller-shop", product?.seller_id],
    queryFn: async () => {
      if (!product?.seller_id) return null;
      const { data } = await (supabase as any)
        .rpc("get_public_seller_shops", { p_user_id: product.seller_id });
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!product?.seller_id,
  });

  // Get other products from same seller
  const { data: sellerProducts } = useQuery({
    queryKey: ["seller-other-products", product?.seller_id, productId],
    queryFn: async () => {
      if (!product?.seller_id) return [];
      const { data } = await supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("seller_id", product.seller_id)
        .eq("is_active", true)
        .neq("id", productId!)
        .order("created_at", { ascending: false })
        .limit(8);
      return data || [];
    },
    enabled: !!product?.seller_id,
  });

  const isInCart = items.some((item) => item.product.id === product?.id);

  const colorOptions = product?.available_colors?.filter(Boolean) || [];
  const sizeOptions = product?.available_sizes?.filter(Boolean) || [];
  const requiresColor = colorOptions.length > 0;
  const requiresSize = sizeOptions.length > 0;
  const canAddToCart = (!requiresColor || !!selectedColor) && (!requiresSize || !!selectedSize);

  useEffect(() => {
    setSelectedColor(colorOptions[0] || "");
    setSelectedSize(sizeOptions[0] || "");
  }, [product?.id]);

  const handleAddToCart = () => {
    if (!product || !canAddToCart) return;
    addItem(product, quantity, { selectedColor, selectedSize });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Produit introuvable</h1>
          <Button asChild><Link to="/products"><ArrowLeft className="h-4 w-4 mr-2" />Retour aux produits</Link></Button>
        </div>
        <Footer />
      </main>
    );
  }

  const currencySymbol = CURRENCY_SYMBOLS[product.currency as keyof typeof CURRENCY_SYMBOLS] || "$";
  const images = product.images?.length ? product.images : ["/placeholder.svg"];

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/products"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0 ${i === selectedImage ? "border-primary" : "border-transparent"}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              {product.category && <Badge variant="secondary" className="mb-2">{t(`categories.items.${product.category.icon}`, { defaultValue: product.category.name })}</Badge>}
              <h1 className="text-2xl font-bold">{product.name}</h1>
              <p className="text-3xl font-bold text-primary mt-2">{currencySymbol} {product.price.toLocaleString()}</p>
            </div>

            {product.description && (
              <p className="text-muted-foreground">{product.description}</p>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {product.stock_quantity > 0 ? (
                <Badge variant="outline" className="text-green-600">En stock ({product.stock_quantity})</Badge>
              ) : (
                <Badge variant="destructive">Épuisé</Badge>
              )}
            </div>

            {(requiresColor || requiresSize) && (
              <div className="space-y-4">
                {requiresColor && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Couleur</p>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <Button
                          key={color}
                          type="button"
                          variant={selectedColor === color ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedColor(color)}
                        >
                          {color}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {requiresSize && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{product.size_type === "shoe" ? "Pointure" : "Taille"}</p>
                    <div className="flex flex-wrap gap-2">
                      {sizeOptions.map((size) => (
                        <Button
                          key={size}
                          type="button"
                          variant={selectedSize === size ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedSize(size)}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantity + Add to cart */}
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-lg">
                <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(quantity + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
              <Button className="flex-1" size="lg" disabled={product.stock_quantity === 0 || !canAddToCart} onClick={handleAddToCart}>
                {added ? <><Check className="h-5 w-5 mr-2" />Ajouté !</> : <><ShoppingCart className="h-5 w-5 mr-2" />Ajouter au panier</>}
              </Button>
            </div>

            {/* Seller info */}
            {(shop || seller) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{shop?.shop_name || seller?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{shop?.shop_city || seller?.city}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/shop/${product.seller_id}`}>Voir la boutique</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Other products from this seller */}
        {sellerProducts && sellerProducts.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Autres produits de cette boutique</h2>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/shop/${product.seller_id}`}>Tout voir</Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {sellerProducts.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
