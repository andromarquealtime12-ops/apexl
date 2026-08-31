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
    PostgrestVersion: "14.5"
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
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_robot_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          status: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      admin_robot_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_deposits: {
        Row: {
          admin_notes: string | null
          agent_id: string
          amount: number
          created_at: string
          currency: string | null
          customer_user_id: string
          id: string
          processed_at: string | null
          processed_by: string | null
          proof_image_url: string | null
          status: string | null
          transaction_reference: string | null
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          amount: number
          created_at?: string
          currency?: string | null
          customer_user_id: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          proof_image_url?: string | null
          status?: string | null
          transaction_reference?: string | null
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          created_at?: string
          currency?: string | null
          customer_user_id?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          proof_image_url?: string | null
          status?: string | null
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_deposits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "deposit_agents"
            referencedColumns: ["id"]
          },
        ]
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
      currency_rates: {
        Row: {
          from_currency: string
          id: string
          rate: number
          to_currency: string
          updated_at: string
        }
        Insert: {
          from_currency: string
          id?: string
          rate?: number
          to_currency: string
          updated_at?: string
        }
        Update: {
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_verification: {
        Row: {
          attempt_count: number | null
          created_at: string
          delivery_code: string | null
          delivery_verified_at: string | null
          id: string
          order_id: string
          pickup_code: string | null
          pickup_verified_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          delivery_code?: string | null
          delivery_verified_at?: string | null
          id?: string
          order_id: string
          pickup_code?: string | null
          pickup_verified_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          delivery_code?: string | null
          delivery_verified_at?: string | null
          id?: string
          order_id?: string
          pickup_code?: string | null
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
      delivery_zones: {
        Row: {
          active: boolean
          base_fee: number
          center_lat: number | null
          center_lng: number | null
          city: string | null
          country: string
          created_at: string
          currency: string
          fee_per_km: number
          id: string
          name: string
          radius_km: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_fee?: number
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
          country: string
          created_at?: string
          currency?: string
          fee_per_km?: number
          id?: string
          name: string
          radius_km?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_fee?: number
          center_lat?: number | null
          center_lng?: number | null
          city?: string | null
          country?: string
          created_at?: string
          currency?: string
          fee_per_km?: number
          id?: string
          name?: string
          radius_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      deposit_agents: {
        Row: {
          address: string
          agent_user_id: string | null
          city: string
          commission_percent: number | null
          created_at: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          opening_hours: Json | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address: string
          agent_user_id?: string | null
          city: string
          commission_percent?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string
          agent_user_id?: string | null
          city?: string
          commission_percent?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          opening_hours?: Json | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      deposit_methods: {
        Row: {
          account_name: string | null
          account_number: string | null
          country: string
          created_at: string
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          label: string
          method_key: string
          method_type: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          country?: string
          created_at?: string
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          label: string
          method_key: string
          method_type?: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          country?: string
          created_at?: string
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          label?: string
          method_key?: string
          method_type?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_applications: {
        Row: {
          availability: string | null
          city: string
          created_at: string
          driver_license_back_url: string | null
          driver_license_front_url: string | null
          driver_license_number: string
          id: string
          is_online: boolean | null
          last_location_update: string | null
          latitude: number | null
          license_plate: string
          longitude: number | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string | null
          updated_at: string
          user_id: string
          vehicle_brand: string
          vehicle_model: string | null
          vehicle_registration_url: string | null
          vehicle_type: string
          vehicle_year: string | null
        }
        Insert: {
          availability?: string | null
          city: string
          created_at?: string
          driver_license_back_url?: string | null
          driver_license_front_url?: string | null
          driver_license_number: string
          id?: string
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_plate: string
          longitude?: number | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vehicle_brand: string
          vehicle_model?: string | null
          vehicle_registration_url?: string | null
          vehicle_type: string
          vehicle_year?: string | null
        }
        Update: {
          availability?: string | null
          city?: string
          created_at?: string
          driver_license_back_url?: string | null
          driver_license_front_url?: string | null
          driver_license_number?: string
          id?: string
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_plate?: string
          longitude?: number | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vehicle_brand?: string
          vehicle_model?: string | null
          vehicle_registration_url?: string | null
          vehicle_type?: string
          vehicle_year?: string | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          driver_id: string
          id: string
          is_online: boolean | null
          latitude: number
          longitude: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          id?: string
          is_online?: boolean | null
          latitude: number
          longitude: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          is_online?: boolean | null
          latitude?: number
          longitude?: number
          updated_at?: string
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          admin_comment: string | null
          created_at: string | null
          id: string
          id_document_back: string
          id_document_front: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_photo: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string | null
          id?: string
          id_document_back: string
          id_document_front: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_photo: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string | null
          id?: string
          id_document_back?: string
          id_document_front?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_photo?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          push_sent: boolean
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          push_sent?: boolean
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          push_sent?: boolean
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_chat_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          selected_color: string | null
          selected_size: string | null
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
          selected_color?: string | null
          selected_size?: string | null
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
          selected_color?: string | null
          selected_size?: string | null
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
      order_returns: {
        Row: {
          admin_notes: string | null
          buyer_id: string
          created_at: string
          fault_type: string | null
          id: string
          order_id: string
          reason: string
          refund_amount: number | null
          return_delivery_code: string | null
          return_delivery_fee: number | null
          return_driver_id: string | null
          return_pickup_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_confirmed: boolean | null
          seller_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          buyer_id: string
          created_at?: string
          fault_type?: string | null
          id?: string
          order_id: string
          reason: string
          refund_amount?: number | null
          return_delivery_code?: string | null
          return_delivery_fee?: number | null
          return_driver_id?: string | null
          return_pickup_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_confirmed?: boolean | null
          seller_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          buyer_id?: string
          created_at?: string
          fault_type?: string | null
          id?: string
          order_id?: string
          reason?: string
          refund_amount?: number | null
          return_delivery_code?: string | null
          return_delivery_fee?: number | null
          return_driver_id?: string | null
          return_pickup_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_confirmed?: boolean | null
          seller_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_seller_readiness: {
        Row: {
          id: string
          marked_ready_at: string
          order_id: string
          seller_id: string
        }
        Insert: {
          id?: string
          marked_ready_at?: string
          order_id: string
          seller_id: string
        }
        Update: {
          id?: string
          marked_ready_at?: string
          order_id?: string
          seller_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string | null
          buyer_latitude: number | null
          buyer_longitude: number | null
          created_at: string
          currency: string | null
          delivery_address: string | null
          delivery_address2: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_fee: number | null
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_notes: string | null
          delivery_state: string | null
          delivery_zip: string | null
          driver_id: string | null
          id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          status: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_latitude?: number | null
          buyer_longitude?: number | null
          created_at?: string
          currency?: string | null
          delivery_address?: string | null
          delivery_address2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          driver_id?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          buyer_latitude?: number | null
          buyer_longitude?: number | null
          created_at?: string
          currency?: string | null
          delivery_address?: string | null
          delivery_address2?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_fee?: number | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_notes?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          driver_id?: string | null
          id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          available_colors: string[]
          available_countries: string[] | null
          available_sizes: string[]
          category_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_printful: boolean
          is_shopify: boolean
          name: string
          price: number
          printful_product_id: string | null
          printful_variant_id: string | null
          seller_country: string | null
          seller_id: string
          shopify_product_id: string | null
          shopify_variant_id: string | null
          size_type: string
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          available_colors?: string[]
          available_countries?: string[] | null
          available_sizes?: string[]
          category_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_printful?: boolean
          is_shopify?: boolean
          name: string
          price: number
          printful_product_id?: string | null
          printful_variant_id?: string | null
          seller_country?: string | null
          seller_id: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          size_type?: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          available_colors?: string[]
          available_countries?: string[] | null
          available_sizes?: string[]
          category_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_printful?: boolean
          is_shopify?: boolean
          name?: string
          price?: number
          printful_product_id?: string | null
          printful_variant_id?: string | null
          seller_country?: string | null
          seller_id?: string
          shopify_product_id?: string | null
          shopify_variant_id?: string | null
          size_type?: string
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
          account_status: string | null
          address: string | null
          admin_notes: string | null
          avatar_url: string | null
          backup_email: string | null
          backup_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          id_document_back: string | null
          id_document_front: string | null
          identity_status: string | null
          language: string
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          latitude: number | null
          longitude: number | null
          lost_packages_count: number | null
          personal_info_locked: boolean
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          report_count: number | null
          selfie_photo: string | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          suspension_reason: string | null
          suspension_until: string | null
          total_earned: number | null
          total_spent: number | null
          trust_score: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          whatsapp: string | null
        }
        Insert: {
          account_status?: string | null
          address?: string | null
          admin_notes?: string | null
          avatar_url?: string | null
          backup_email?: string | null
          backup_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean | null
          full_name: string
          id?: string
          id_document_back?: string | null
          id_document_front?: string | null
          identity_status?: string | null
          language?: string
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          latitude?: number | null
          longitude?: number | null
          lost_packages_count?: number | null
          personal_info_locked?: boolean
          phone?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          report_count?: number | null
          selfie_photo?: string | null
          shop_address?: string | null
          shop_latitude?: number | null
          shop_longitude?: number | null
          suspension_reason?: string | null
          suspension_until?: string | null
          total_earned?: number | null
          total_spent?: number | null
          trust_score?: number | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
          user_id: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          account_status?: string | null
          address?: string | null
          admin_notes?: string | null
          avatar_url?: string | null
          backup_email?: string | null
          backup_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean | null
          full_name?: string
          id?: string
          id_document_back?: string | null
          id_document_front?: string | null
          identity_status?: string | null
          language?: string
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          latitude?: number | null
          longitude?: number | null
          lost_packages_count?: number | null
          personal_info_locked?: boolean
          phone?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          referred_by?: string | null
          report_count?: number | null
          selfie_photo?: string | null
          shop_address?: string | null
          shop_latitude?: number | null
          shop_longitude?: number | null
          suspension_reason?: string | null
          suspension_until?: string | null
          total_earned?: number | null
          total_spent?: number | null
          trust_score?: number | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string
          user_id?: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          orders_count: number | null
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          orders_count?: number | null
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          orders_count?: number | null
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: string | null
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          order_id: string
          reason: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          order_id: string
          reason: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          reported_order_id: string | null
          reported_product_id: string | null
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          reported_order_id?: string | null
          reported_product_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          reported_order_id?: string | null
          reported_product_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
      restaurant_items: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          preparation_time: number | null
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          preparation_time?: number | null
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          preparation_time?: number | null
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          city: string
          cover_url: string | null
          created_at: string
          cuisine_type: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          seller_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address: string
          city: string
          cover_url?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          seller_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string
          city?: string
          cover_url?: string | null
          created_at?: string
          cuisine_type?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          seller_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      return_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          message: string | null
          return_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string | null
          return_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          message?: string | null
          return_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_messages_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "order_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          order_id: string | null
          rating: number
          review_type: string | null
          reviewed_user_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          order_id?: string | null
          rating: number
          review_type?: string | null
          reviewed_user_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          order_id?: string | null
          rating?: number
          review_type?: string | null
          reviewed_user_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_applications: {
        Row: {
          business_type: string | null
          created_at: string
          id: string
          id_document_back_url: string | null
          id_document_front_url: string | null
          latitude: number | null
          longitude: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
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
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          latitude?: number | null
          longitude?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
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
          id_document_back_url?: string | null
          id_document_front_url?: string | null
          latitude?: number | null
          longitude?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
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
      shopify_connections: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          seller_id: string
          shop_domain: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          seller_id: string
          shop_domain: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          seller_id?: string
          shop_domain?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          is_admin_reply: boolean | null
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_admin_reply?: boolean | null
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_admin_reply?: boolean | null
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string | null
          id: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_auth_secrets: {
        Row: {
          created_at: string | null
          id: string
          two_factor_secret: string | null
          updated_at: string | null
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          two_factor_secret?: string | null
          updated_at?: string | null
          user_id: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          two_factor_secret?: string | null
          updated_at?: string | null
          user_id?: string
          verification_code?: string | null
          verification_code_expires_at?: string | null
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
          earnings_dop: number
          earnings_htg: number
          earnings_usd: number
          frozen_at: string | null
          frozen_by: string | null
          frozen_reason: string | null
          id: string
          is_active: boolean | null
          is_frozen: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_dop?: number | null
          balance_htg?: number | null
          balance_usd?: number | null
          created_at?: string
          earnings_dop?: number
          earnings_htg?: number
          earnings_usd?: number
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_dop?: number | null
          balance_htg?: number | null
          balance_usd?: number | null
          created_at?: string
          earnings_dop?: number
          earnings_htg?: number
          earnings_usd?: number
          frozen_at?: string | null
          frozen_by?: string | null
          frozen_reason?: string | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean | null
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
      activate_user: { Args: { p_user_id: string }; Returns: Json }
      admin_cancel_delivery: {
        Args: {
          p_credit_amount?: number
          p_credit_driver?: boolean
          p_order_id: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_clear_negative_balance: {
        Args: { p_currency?: string; p_user_id: string }
        Returns: Json
      }
      admin_driver_overview: {
        Args: never
        Returns: {
          account_status: string
          cancelled_count: number
          city: string
          delivered_count: number
          driver_id: string
          earnings_dop: number
          earnings_htg: number
          earnings_usd: number
          full_name: string
          identity_status: string
          in_progress_count: number
          is_online: boolean
          last_location_update: string
          latitude: number
          longitude: number
          phone: string
          total_orders: number
        }[]
      }
      admin_get_profile: {
        Args: { _user_id: string }
        Returns: {
          account_status: string | null
          address: string | null
          admin_notes: string | null
          avatar_url: string | null
          backup_email: string | null
          backup_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          id_document_back: string | null
          id_document_front: string | null
          identity_status: string | null
          language: string
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          latitude: number | null
          longitude: number | null
          lost_packages_count: number | null
          personal_info_locked: boolean
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          report_count: number | null
          selfie_photo: string | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          suspension_reason: string | null
          suspension_until: string | null
          total_earned: number | null
          total_spent: number | null
          trust_score: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_profiles: {
        Args: never
        Returns: {
          account_status: string | null
          address: string | null
          admin_notes: string | null
          avatar_url: string | null
          backup_email: string | null
          backup_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          id_document_back: string | null
          id_document_front: string | null
          identity_status: string | null
          language: string
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          latitude: number | null
          longitude: number | null
          lost_packages_count: number | null
          personal_info_locked: boolean
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          report_count: number | null
          selfie_photo: string | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          suspension_reason: string | null
          suspension_until: string | null
          total_earned: number | null
          total_spent: number | null
          trust_score: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      agent_deposit_to_wallet: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_email: string
          p_notes?: string
        }
        Returns: Json
      }
      agent_withdraw_from_wallet: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_email: string
          p_notes?: string
        }
        Returns: Json
      }
      approve_deposit: { Args: { transaction_id_input: string }; Returns: Json }
      approve_driver_application: {
        Args: { application_id: string }
        Returns: boolean
      }
      approve_identity_verification: {
        Args: { p_comment?: string; p_verification_id: string }
        Returns: Json
      }
      approve_return: {
        Args: { p_fault_type?: string; p_return_id: string }
        Returns: Json
      }
      approve_seller_application: {
        Args: { application_id: string }
        Returns: boolean
      }
      approve_withdrawal: { Args: { p_transaction_id: string }; Returns: Json }
      assign_driver_to_order: {
        Args: { p_driver_id: string; p_order_id: string }
        Returns: Json
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      can_withdraw: { Args: { _user_id: string }; Returns: boolean }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      cancel_pending_moncash_deposits:
        | { Args: { p_reason?: string }; Returns: Json }
        | {
            Args: { p_older_than_minutes?: number; p_reason?: string }
            Returns: Json
          }
      cleanup_old_data: { Args: never; Returns: Json }
      confirm_return_received: {
        Args: {
          p_action?: string
          p_confirmed: boolean
          p_notes?: string
          p_return_id: string
        }
        Returns: Json
      }
      convert_wallet_currency: {
        Args: {
          p_amount: number
          p_from_currency: string
          p_to_currency: string
        }
        Returns: Json
      }
      create_delivery_verification: {
        Args: { p_order_id: string }
        Returns: Json
      }
      credit_wallet_atomic: {
        Args: {
          p_amount: number
          p_currency: string
          p_description: string
          p_payment_method: string
          p_transaction_reference: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_my_restaurant: { Args: never; Returns: Json }
      delete_my_shop: { Args: never; Returns: Json }
      delete_user_account: { Args: { p_user_id: string }; Returns: Json }
      demo_wallet_topup: {
        Args: { p_amount: number; p_currency: string }
        Returns: Json
      }
      driver_accept_order: { Args: { p_order_id: string }; Returns: Json }
      driver_accept_return: { Args: { p_return_id: string }; Returns: Json }
      enforce_negative_balance_suspension: { Args: never; Returns: number }
      ensure_wallet: { Args: { p_user_id: string }; Returns: string }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      freeze_wallet: {
        Args: { p_reason: string; p_user_id: string }
        Returns: Json
      }
      generate_pin_code: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_active_deposit_agents_public: {
        Args: never
        Returns: {
          address: string
          city: string
          id: string
          is_active: boolean
          is_verified: boolean
          name: string
          opening_hours: string
        }[]
      }
      get_active_deposit_methods: {
        Args: never
        Returns: {
          account_name: string | null
          account_number: string | null
          country: string
          created_at: string
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          label: string
          method_key: string
          method_type: string
          sort_order: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "deposit_methods"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_buyer_order_ids: { Args: never; Returns: string[] }
      get_driver_order_ids: { Args: never; Returns: string[] }
      get_my_profile: {
        Args: never
        Returns: {
          account_status: string | null
          address: string | null
          admin_notes: string | null
          avatar_url: string | null
          backup_email: string | null
          backup_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          id_document_back: string | null
          id_document_front: string | null
          identity_status: string | null
          language: string
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          latitude: number | null
          longitude: number | null
          lost_packages_count: number | null
          personal_info_locked: boolean
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          report_count: number | null
          selfie_photo: string | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          suspension_reason: string | null
          suspension_until: string | null
          total_earned: number | null
          total_spent: number | null
          trust_score: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_nearby_drivers: {
        Args: { p_latitude: number; p_longitude: number; p_radius_km?: number }
        Returns: {
          distance_km: number
          driver_id: string
          latitude: number
          longitude: number
          updated_at: string
        }[]
      }
      get_order_contact: {
        Args: { _other_user: string }
        Returns: {
          full_name: string
          phone: string
          whatsapp: string
        }[]
      }
      get_own_profile: {
        Args: never
        Returns: {
          account_status: string | null
          address: string | null
          admin_notes: string | null
          avatar_url: string | null
          backup_email: string | null
          backup_phone: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email_verified: boolean | null
          full_name: string
          id: string
          id_document_back: string | null
          id_document_front: string | null
          identity_status: string | null
          language: string
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          latitude: number | null
          longitude: number | null
          lost_packages_count: number | null
          personal_info_locked: boolean
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          referred_by: string | null
          report_count: number | null
          selfie_photo: string | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          suspension_reason: string | null
          suspension_until: string | null
          total_earned: number | null
          total_spent: number | null
          trust_score: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_code_expires_at: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_seller_shops: {
        Args: { p_user_id?: string }
        Returns: {
          created_at: string
          id: string
          latitude: number
          longitude: number
          shop_address: string
          shop_city: string
          shop_description: string
          shop_name: string
          user_id: string
        }[]
      }
      get_seller_order_ids: { Args: never; Returns: string[] }
      get_shop_public_info: {
        Args: { p_seller_ids: string[] }
        Returns: {
          latitude: number
          longitude: number
          shop_address: string
          shop_city: string
          shop_name: string
          shop_phone: string
          user_id: string
        }[]
      }
      get_user_language: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_participant: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      mark_seller_items_ready: { Args: { p_order_id: string }; Returns: Json }
      notify_available_drivers_for_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      notify_order_participant: {
        Args: {
          _action_url?: string
          _message: string
          _order_id: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      process_cash_checkout: {
        Args: {
          p_buyer_id: string
          p_currency: string
          p_delivery_address: string
          p_delivery_city: string
          p_delivery_fee: number
          p_delivery_notes: string
          p_order_items: Json
          p_total_amount: number
        }
        Returns: Json
      }
      process_checkout: {
        Args: {
          p_buyer_id: string
          p_currency: string
          p_delivery_address: string
          p_delivery_city: string
          p_delivery_fee: number
          p_delivery_notes: string
          p_order_items: Json
          p_total_amount: number
        }
        Returns: Json
      }
      process_refund: {
        Args: { p_approved: boolean; p_notes?: string; p_refund_id: string }
        Returns: Json
      }
      regenerate_pickup_code: { Args: { p_order_id: string }; Returns: Json }
      reject_deposit: {
        Args: { reason_input?: string; transaction_id_input: string }
        Returns: Json
      }
      reject_identity_verification: {
        Args: { p_reason: string; p_verification_id: string }
        Returns: Json
      }
      reject_withdrawal: {
        Args: { p_reason?: string; p_transaction_id: string }
        Returns: Json
      }
      request_refund: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      request_return: {
        Args: { p_order_id: string; p_reason: string }
        Returns: Json
      }
      request_withdrawal: {
        Args: {
          p_account_details: string
          p_amount: number
          p_currency: string
          p_payment_method: Database["public"]["Enums"]["payment_method_type"]
        }
        Returns: Json
      }
      robot_auto_approve_deposit: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      robot_auto_approve_driver: {
        Args: { p_application_id: string }
        Returns: Json
      }
      robot_auto_approve_seller: {
        Args: { p_application_id: string }
        Returns: Json
      }
      robot_auto_approve_withdrawal: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      robot_auto_suspend_lost_packages: { Args: never; Returns: Json }
      robot_auto_suspend_reported: { Args: never; Returns: Json }
      robot_auto_verify_identity: {
        Args: { p_verification_id: string }
        Returns: Json
      }
      robot_caller_allowed: { Args: never; Returns: boolean }
      run_admin_robot: { Args: never; Returns: Json }
      submit_deposit_request: {
        Args: {
          p_amount: number
          p_currency: string
          p_payment_method: Database["public"]["Enums"]["payment_method_type"]
          p_proof_path: string
          p_transaction_reference: string
        }
        Returns: Json
      }
      suspend_user: {
        Args: { p_duration_days?: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      transfer_earnings_to_wallet: {
        Args: { p_amount: number; p_currency: string }
        Returns: Json
      }
      unfreeze_wallet: { Args: { p_user_id: string }; Returns: Json }
      update_pickup_location: {
        Args: {
          p_address?: string
          p_city?: string
          p_lat: number
          p_lng: number
          p_restaurant_id?: string
        }
        Returns: Json
      }
      validate_admin_code: { Args: { code_input: string }; Returns: boolean }
      verify_delivery_code: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
      verify_pickup_code: {
        Args: { p_code: string; p_order_id: string }
        Returns: Json
      }
      verify_return_delivery: {
        Args: { p_code: string; p_return_id: string }
        Returns: Json
      }
      verify_return_pickup: {
        Args: { p_code: string; p_return_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "buyer" | "seller" | "driver" | "agent"
      payment_method_type:
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
        | "bank_other"
        | "cash"
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
      app_role: ["admin", "buyer", "seller", "driver", "agent"],
      payment_method_type: [
        "card_visa",
        "card_mastercard",
        "orange_money",
        "moncash",
        "banreservas",
        "bhd",
        "bank_transfer_do",
        "bank_transfer_ht",
        "paypal",
        "wise",
        "popular",
        "bank_other",
        "cash",
      ],
    },
  },
} as const
