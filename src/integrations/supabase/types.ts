export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_access_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          uses_remaining: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          uses_remaining?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          uses_remaining?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_ht: string | null
          parent_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_ht?: string | null
          parent_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_ht?: string | null
          parent_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_verification: {
        Row: {
          created_at: string
          delivery_code: string | null
          delivery_verified_at: string | null
          id: string
          order_id: string
          pickup_code: string
          pickup_verified_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_code?: string | null
          delivery_verified_at?: string | null
          id?: string
          order_id: string
          pickup_code: string
          pickup_verified_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_code?: string | null
          delivery_verified_at?: string | null
          id?: string
          order_id?: string
          pickup_code?: string
          pickup_verified_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_verification_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_applications: {
        Row: {
          availability: string | null
          city: string
          created_at: string
          driver_license_number: string
          id: string
          license_plate: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string
          user_id: string
          vehicle_brand: string
          vehicle_model: string | null
          vehicle_type: string
          vehicle_year: string | null
        }
        Insert: {
          availability?: string | null
          city: string
          created_at?: string
          driver_license_number: string
          id?: string
          license_plate: string
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vehicle_brand: string
          vehicle_model?: string | null
          vehicle_type: string
          vehicle_year?: string | null
        }
        Update: {
          availability?: string | null
          city?: string
          created_at?: string
          driver_license_number?: string
          id?: string
          license_plate?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string
          vehicle_model?: string | null
          vehicle_type?: string
          vehicle_year?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          seller_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          seller_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          seller_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string | null
          created_at: string
          currency: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_fee: number | null
          delivery_notes: string | null
          driver_id: string | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status: string | null
          status: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          currency?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_notes?: string | null
          driver_id?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          currency?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_notes?: string | null
          driver_id?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          seller_id: string
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price: number
          seller_id: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          seller_id?: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          email_verified: boolean | null
          full_name: string
          id: string
          phone: string | null
          phone_verified: boolean | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email_verified?: boolean | null
          full_name: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email_verified?: boolean | null
          full_name?: string
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
          user_id?: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          business_type: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_address: string
          shop_city: string
          shop_description: string | null
          shop_name: string
          shop_phone: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_type?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_address: string
          shop_city: string
          shop_description?: string | null
          shop_name: string
          shop_phone: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_type?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_address?: string
          shop_city?: string
          shop_description?: string | null
          shop_name?: string
          shop_phone?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          description: string | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_image_url: string | null
          reference: string | null
          status: string | null
          transaction_reference: string | null
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_image_url?: string | null
          reference?: string | null
          status?: string | null
          transaction_reference?: string | null
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          proof_image_url?: string | null
          reference?: string | null
          status?: string | null
          transaction_reference?: string | null
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_dop: number | null
          balance_htg: number | null
          balance_usd: number | null
          created_at: string
          id: string
          is_active: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_dop?: number | null
          balance_htg?: number | null
          balance_usd?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_dop?: number | null
          balance_htg?: number | null
          balance_usd?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_driver_application: {
        Args: { application_id: string }
        Returns: boolean
      }
      approve_seller_application: {
        Args: { application_id: string }
        Returns: boolean
      }
      create_delivery_verification: {
        Args: { p_order_id: string }
        Returns: Json
      }
      generate_pin_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_admin_code: {
        Args: { code_input: string; user_id_input: string }
        Returns: boolean
      }
      verify_delivery_code: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
      verify_pickup_code: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "buyer" | "seller" | "driver"
      payment_method_type:
        | "card_visa"
        | "card_mastercard"
        | "orange_money"
        | "moncash"
        | "banreservas"
        | "bhd"
        | "bank_transfer_do"
        | "bank_transfer_ht"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "buyer", "seller", "driver"],
      payment_method_type: [
        "card_visa",
        "card_mastercard",
        "orange_money",
        "moncash",
        "banreservas",
        "bhd",
        "bank_transfer_do",
        "bank_transfer_ht",
      ],
    },
  },
} as const
