import { useState, useEffect, useRef } from "react";
import { useCreateProduct, useUpdateProduct } from "@/hooks/useSellerProducts";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
}

export default function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    stock_quantity: "",
    is_active: true,
    images: [] as string[],
    available_colors: "",
    available_sizes: "",
    size_type: "standard",
  });

  const parseList = (value: string) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

  const sizeLabel = formData.size_type === "shoe" ? "Pointures disponibles" : "Tailles disponibles";
  const sizePlaceholder =
    formData.size_type === "shoe"
      ? "Ex: 38, 39, 40, 41, 42"
      : formData.size_type === "custom"
        ? "Ex: Unique, 2 ans, 4 ans"
        : "Ex: XS, S, M, L, XL, XXL";

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price?.toString() || "",
        category_id: product.category_id || "",
        stock_quantity: product.stock_quantity?.toString() || "",
        is_active: product.is_active ?? true,
        images: product.images || [],
          available_colors: product.available_colors?.join(", ") || "",
          available_sizes: product.available_sizes?.join(", ") || "",
          size_type: product.size_type || "standard",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        price: "",
        category_id: "",
        stock_quantity: "",
        is_active: true,
        images: [],
          available_colors: "",
          available_sizes: "",
          size_type: "standard",
      });
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      toast.error("Le nom et le prix sont requis");
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: parseFloat(formData.price),
        category_id: formData.category_id || undefined,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : 0,
        is_active: formData.is_active,
        images: formData.images,
        currency: "DOP",
        available_colors: parseList(formData.available_colors),
        available_sizes: parseList(formData.available_sizes),
        size_type: formData.size_type,
      };

      if (product) {
        await updateProduct.mutateAsync({ id: product.id, ...data });
        toast.success("Produit mis à jour");
      } else {
        await createProduct.mutateAsync(data);
        toast.success("Produit créé");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const isLoading = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] p-0 flex flex-col gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          <DialogDescription>
            {product ? "Modifiez les informations du produit" : "Ajoutez un nouveau produit à votre boutique"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du produit *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: T-shirt coton bio"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez votre produit..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Prix (RD$) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Quantité en stock</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {t(`categories.items.${cat.icon}`, { defaultValue: cat.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="available_colors">Couleurs disponibles</Label>
              <Input
                id="available_colors"
                value={formData.available_colors}
                onChange={(e) => setFormData(prev => ({ ...prev, available_colors: e.target.value }))}
                placeholder="Ex: Noir, Blanc, Rouge"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="size_type">Type de tailles</Label>
              <Select
                value={formData.size_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, size_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Vêtements</SelectItem>
                  <SelectItem value="shoe">Chaussures / tennis</SelectItem>
                  <SelectItem value="custom">Autres tailles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="available_sizes">{sizeLabel}</Label>
            <Input
              id="available_sizes"
              value={formData.available_sizes}
              onChange={(e) => setFormData(prev => ({ ...prev, available_sizes: e.target.value }))}
              placeholder={sizePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label>Images du produit</Label>
            <div className="flex flex-wrap gap-2">
              {formData.images.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"
                    onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="w-20 h-20 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || !user) return;
                setUploading(true);
                const newUrls: string[] = [];
                for (const file of Array.from(files)) {
                  const ext = file.name.split(".").pop();
                  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                  const { error } = await supabase.storage.from("product-images").upload(path, file);
                  if (!error) {
                    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                    newUrls.push(urlData.publicUrl);
                  }
                }
                setFormData(prev => ({ ...prev, images: [...prev.images, ...newUrls] }));
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </div>

          </div>

          <DialogFooter className="p-4 border-t bg-background shrink-0 sticky bottom-0 flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : product ? (
                "Mettre à jour"
              ) : (
                "Créer le produit"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
