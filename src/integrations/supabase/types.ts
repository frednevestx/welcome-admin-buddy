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
      categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_settings: {
        Row: {
          cycle: Database["public"]["Enums"]["billing_cycle"]
          discount_label: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          url: string
        }
        Insert: {
          cycle: Database["public"]["Enums"]["billing_cycle"]
          discount_label?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          url?: string
        }
        Update: {
          cycle?: Database["public"]["Enums"]["billing_cycle"]
          discount_label?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cmv_settings: {
        Row: {
          restaurant_id: string
          target_percent: number
          updated_at: string
        }
        Insert: {
          restaurant_id: string
          target_percent?: number
          updated_at?: string
        }
        Update: {
          restaurant_id?: string
          target_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cmv_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          period: Database["public"]["Enums"]["goal_period"]
          reference_date: string
          restaurant_id: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          period: Database["public"]["Enums"]["goal_period"]
          reference_date?: string
          restaurant_id: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          reference_date?: string
          restaurant_id?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          file_hash: string | null
          filename: string
          id: string
          imported_at: string
          imported_by: string | null
          restaurant_id: string
          rows_imported: number
          source: Database["public"]["Enums"]["sale_source"]
        }
        Insert: {
          file_hash?: string | null
          filename: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          restaurant_id: string
          rows_imported?: number
          source: Database["public"]["Enums"]["sale_source"]
        }
        Update: {
          file_hash?: string | null
          filename?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          restaurant_id?: string
          rows_imported?: number
          source?: Database["public"]["Enums"]["sale_source"]
        }
        Relationships: [
          {
            foreignKeyName: "imports_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          created_at: string
          current_price: number
          id: string
          name: string
          restaurant_id: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_price?: number
          id?: string
          name: string
          restaurant_id: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          restaurant_id?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          movement_date: string
          notes: string | null
          payment_method: string | null
          restaurant_id: string
          supplier_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id: string
          supplier_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_date?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id?: string
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "movements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          purchase_date: string
          restaurant_id: string
          supplier_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          purchase_date?: string
          restaurant_id: string
          supplier_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          purchase_date?: string
          restaurant_id?: string
          supplier_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          cancellations: number
          commission: number
          coupons: number
          created_at: string
          created_by: string | null
          delivery_fee: number
          fees: number
          gross_amount: number
          id: string
          import_id: string | null
          marketing_fee: number
          net_amount: number
          orders_count: number
          restaurant_id: string
          sale_date: string
          source: Database["public"]["Enums"]["sale_source"]
        }
        Insert: {
          cancellations?: number
          commission?: number
          coupons?: number
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          fees?: number
          gross_amount?: number
          id?: string
          import_id?: string | null
          marketing_fee?: number
          net_amount?: number
          orders_count?: number
          restaurant_id: string
          sale_date: string
          source: Database["public"]["Enums"]["sale_source"]
        }
        Update: {
          cancellations?: number
          commission?: number
          coupons?: number
          created_at?: string
          created_by?: string | null
          delivery_fee?: number
          fees?: number
          gross_amount?: number
          id?: string
          import_id?: string | null
          marketing_fee?: number
          net_amount?: number
          orders_count?: number
          restaurant_id?: string
          sale_date?: string
          source?: Database["public"]["Enums"]["sale_source"]
        }
        Relationships: [
          {
            foreignKeyName: "sales_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"] | null
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          products: string | null
          restaurant_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          products?: string | null
          restaurant_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          products?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wastages: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_amount: number
          notes: string | null
          product_name: string
          quantity: number
          reason: string | null
          restaurant_id: string
          unit: string | null
          wastage_date: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lost_amount?: number
          notes?: string | null
          product_name: string
          quantity?: number
          reason?: string | null
          restaurant_id: string
          unit?: string | null
          wastage_date?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lost_amount?: number
          notes?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          restaurant_id?: string
          unit?: string | null
          wastage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "wastages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_extend_plan: {
        Args: { _days: number; _user_id: string }
        Returns: undefined
      }
      admin_grant_plan_by_email: {
        Args: {
          _days: number
          _email: string
          _plan: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: string
      }
      admin_revoke_plan: { Args: { _user_id: string }; Returns: undefined }
      current_restaurant_id: { Args: never; Returns: string }
      effective_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      has_plan: {
        Args: {
          _min: Database["public"]["Enums"]["plan_tier"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_effective_plan: {
        Args: never
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      seed_default_categories: {
        Args: { _restaurant_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      billing_cycle: "mensal" | "semestral" | "anual"
      goal_period: "diaria" | "semanal" | "mensal"
      movement_type: "compra" | "despesa"
      plan_tier: "basico" | "pro" | "premium"
      sale_source: "ifood" | "99food" | "loja" | "whatsapp"
      subscription_status: "trialing" | "active" | "expired" | "canceled"
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
      app_role: ["admin", "user"],
      billing_cycle: ["mensal", "semestral", "anual"],
      goal_period: ["diaria", "semanal", "mensal"],
      movement_type: ["compra", "despesa"],
      plan_tier: ["basico", "pro", "premium"],
      sale_source: ["ifood", "99food", "loja", "whatsapp"],
      subscription_status: ["trialing", "active", "expired", "canceled"],
    },
  },
} as const
