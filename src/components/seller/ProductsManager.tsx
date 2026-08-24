import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSellerProducts } from "@/hooks/useSellerStats";
import { useDeleteProduct, useToggleProductStatus } from "@/hooks/useSellerProducts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Package, ImageOff } from "lucide-react";
import { toast } from "sonner";
import ProductFormDialog from "./ProductFormDialog";

export default function ProductsManager() {
  const { t } = useTranslation();
  const { data: products, isLoading } = useSellerProducts();
  const deleteProduct = useDeleteProduct();
  const toggleStatus = useToggleProductStatus();
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct.mutateAsync(productToDelete);
      toast.success(t("sellerx.products.toasts.deleted"));
      setProductToDelete(null);
    } catch (error) {
      toast.error(t("sellerx.products.toasts.deleteError"));
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleStatus.mutateAsync({ id, is_active: !currentStatus });
      toast.success(currentStatus ? t("sellerx.products.toasts.deactivated") : t("sellerx.products.toasts.activated"));
    } catch (error) {
      toast.error(t("sellerx.products.toasts.updateError"));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {t("sellerx.products.count", { count: products?.length || 0 })}
        </p>
        <Button onClick={() => setShowAddDialog(true)} size="lg" className="gap-2 shadow-md">
          <Plus className="h-5 w-5" />
          {t("sellerx.products.add")}
        </Button>
      </div>

      {!products || products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t("sellerx.products.empty.title")}</p>
          <p className="text-sm mb-4">{t("sellerx.products.empty.subtitle")}</p>
          <Button onClick={() => setShowAddDialog(true)} size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            {t("sellerx.products.addFirst")}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("sellerx.products.table.image")}</TableHead>
                <TableHead>{t("sellerx.products.table.product")}</TableHead>
                <TableHead>{t("sellerx.products.table.price")}</TableHead>
                <TableHead>{t("sellerx.products.table.stock")}</TableHead>
                <TableHead>{t("sellerx.products.table.active")}</TableHead>
                <TableHead className="text-right">{t("sellerx.products.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(product.categories as any)?.name || t("sellerx.products.noCategory")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(product.price)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.stock_quantity && product.stock_quantity > 0 ? "secondary" : "destructive"}>
                      {product.stock_quantity || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={product.is_active ?? false}
                      onCheckedChange={() => handleToggleStatus(product.id, product.is_active ?? false)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingProduct(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setProductToDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        product={null}
      />

      <ProductFormDialog
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        product={editingProduct}
      />

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sellerx.products.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sellerx.products.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("sellerx.products.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("sellerx.products.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
