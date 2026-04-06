import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "@/types/database";

export interface CartItemSelection {
  selectedColor?: string;
  selectedSize?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, selection?: CartItemSelection) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getDeliveryFee: (distanceKm?: number) => number;
  getTotal: (distanceKm?: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "ayiti-market-cart";

const getCartItemId = (productId: string, selectedColor?: string, selectedSize?: string) =>
  [productId, selectedColor || "", selectedSize || ""].join("::");

const normalizeStoredItems = (raw: unknown): CartItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Partial<CartItem> & { product: Product; quantity: number } => !!item && typeof item === "object" && "product" in item && "quantity" in item)
    .map((item) => ({
      id: item.id || getCartItemId(item.product.id, item.selectedColor, item.selectedSize),
      product: item.product,
      quantity: item.quantity,
      selectedColor: item.selectedColor,
      selectedSize: item.selectedSize,
    }));
};

// Price per km in DOP
const DELIVERY_BASE_FEE = 50; // base fee
const DELIVERY_PER_KM = 25; // per km

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      try {
        setItems(normalizeStoredItems(JSON.parse(storedCart)));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product, quantity: number = 1, selection: CartItemSelection = {}) => {
    const itemId = getCartItemId(product.id, selection.selectedColor, selection.selectedSize);

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === itemId);
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }

      return [
        ...currentItems,
        {
          id: itemId,
          product,
          quantity,
          selectedColor: selection.selectedColor,
          selectedSize: selection.selectedSize,
        },
      ];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(itemId); return; }
    setItems((currentItems) =>
      currentItems.map((item) => item.id === itemId ? { ...item, quantity } : item)
    );
  };

  const clearCart = () => setItems([]);

  const getItemCount = () => items.reduce((total, item) => total + item.quantity, 0);

  const getSubtotal = () => items.reduce((total, item) => total + item.product.price * item.quantity, 0);

  const getDeliveryFee = (distanceKm?: number) => {
    if (!distanceKm || distanceKm <= 0) return DELIVERY_BASE_FEE + DELIVERY_PER_KM * 5; // default ~5km
    return Math.round(DELIVERY_BASE_FEE + DELIVERY_PER_KM * distanceKm);
  };

  const getTotal = (distanceKm?: number) => getSubtotal() + getDeliveryFee(distanceKm);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, getItemCount, getSubtotal, getDeliveryFee, getTotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error("useCart must be used within a CartProvider");
  return context;
}
