import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product } from "@/types/database";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getDeliveryFee: (distanceKm?: number) => number;
  getTotal: (distanceKm?: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "ayiti-market-cart";

// Price per km in DOP
const DELIVERY_BASE_FEE = 50; // base fee
const DELIVERY_PER_KM = 25; // per km

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (storedCart) {
      try {
        setItems(JSON.parse(storedCart));
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product, quantity: number = 1) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.product.id === product.id);
      if (existingItem) {
        return currentItems.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...currentItems, { product, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) { removeItem(productId); return; }
    setItems((currentItems) =>
      currentItems.map((item) => item.product.id === productId ? { ...item, quantity } : item)
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
