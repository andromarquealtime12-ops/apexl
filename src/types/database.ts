export type AppRole = "admin" | "buyer" | "seller" | "driver";

export type PaymentMethodType = 
  | "card_visa" 
  | "card_mastercard" 
  | "orange_money" 
  | "moncash" 
  | "banreservas" 
  | "bhd" 
  | "bank_transfer_do" 
  | "bank_transfer_ht"
  | "paypal"
  | "wise"
  | "popular"
  | "bank_other";

export type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "picked_up" 
  | "delivering" 
  | "delivered" 
  | "cancelled";

export type Currency = "DOP" | "HTG" | "USD";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  country: "DO" | "HT";
  address: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  name_ht: string | null;
  icon: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: Currency;
  available_colors: string[];
  available_sizes: string[];
  size_type: string;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
  seller?: Profile;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_dop: number;
  balance_htg: number;
  balance_usd: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: "deposit" | "withdrawal" | "payment" | "refund" | "transfer";
  amount: number;
  currency: Currency;
  payment_method: PaymentMethodType | null;
  status: "pending" | "completed" | "failed" | "cancelled";
  reference: string | null;
  description: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string | null;
  driver_id: string | null;
  status: OrderStatus;
  total_amount: number;
  delivery_fee: number;
  currency: Currency;
  payment_method: PaymentMethodType | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  seller_id: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  // Joined fields
  product?: Product;
}


export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  DOP: "RD$",
  HTG: "G",
  USD: "$"
};
