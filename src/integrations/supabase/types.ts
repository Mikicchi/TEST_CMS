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
      alerts: {
        Row: {
          card_id: string
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          rule_type: string
          threshold: number
          user_id: string
          window_days: number
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          rule_type?: string
          threshold: number
          user_id: string
          window_days?: number
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          rule_type?: string
          threshold?: number
          user_id?: string
          window_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "alerts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tracked_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          card_id: string | null
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tracked_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      price_snapshots: {
        Row: {
          available_items: number | null
          captured_at: string
          card_id: string
          id: string
          price_avg: number | null
          price_from: number | null
          price_trend: number | null
          user_id: string
        }
        Insert: {
          available_items?: number | null
          captured_at?: string
          card_id: string
          id?: string
          price_avg?: number | null
          price_from?: number | null
          price_trend?: number | null
          user_id: string
        }
        Update: {
          available_items?: number | null
          captured_at?: string
          card_id?: string
          id?: string
          price_avg?: number | null
          price_from?: number | null
          price_trend?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_snapshots_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tracked_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      proxies: {
        Row: {
          anonymity: string | null
          banned_until: string | null
          country_code: string | null
          country_name: string | null
          created_at: string
          failure_count: number
          id: string
          ip: string
          last_checked_at: string | null
          latency_ms: number | null
          port: number
          source: string
          status: string
          success_count: number
          supports_https: boolean
        }
        Insert: {
          anonymity?: string | null
          banned_until?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          ip: string
          last_checked_at?: string | null
          latency_ms?: number | null
          port: number
          source?: string
          status?: string
          success_count?: number
          supports_https?: boolean
        }
        Update: {
          anonymity?: string | null
          banned_until?: string | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          ip?: string
          last_checked_at?: string | null
          latency_ms?: number | null
          port?: number
          source?: string
          status?: string
          success_count?: number
          supports_https?: boolean
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          card_id: string | null
          created_at: string
          duration_ms: number | null
          http_status: number | null
          id: string
          message: string | null
          method: string
          proxy_label: string | null
          status: string
          target_url: string | null
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          duration_ms?: number | null
          http_status?: number | null
          id?: string
          message?: string | null
          method?: string
          proxy_label?: string | null
          status: string
          target_url?: string | null
          user_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          duration_ms?: number | null
          http_status?: number | null
          id?: string
          message?: string | null
          method?: string
          proxy_label?: string | null
          status?: string
          target_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tracked_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_cards: {
        Row: {
          card_url: string
          condition: string | null
          created_at: string
          expansion: string | null
          game: string
          id: string
          is_active: boolean
          language: string | null
          last_error: string | null
          last_scraped_at: string | null
          name: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          card_url: string
          condition?: string | null
          created_at?: string
          expansion?: string | null
          game?: string
          id?: string
          is_active?: boolean
          language?: string | null
          last_error?: string | null
          last_scraped_at?: string | null
          name: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          card_url?: string
          condition?: string | null
          created_at?: string
          expansion?: string | null
          game?: string
          id?: string
          is_active?: boolean
          language?: string | null
          last_error?: string | null
          last_scraped_at?: string | null
          name?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          fallback_scraper: boolean
          jitter_seconds: number
          max_retries_per_card: number
          notify_email: boolean
          notify_in_app: boolean
          notify_telegram: boolean
          refresh_interval_minutes: number
          requests_per_minute: number
          telegram_chat_id: string | null
          updated_at: string
          use_proxies: boolean
          user_id: string
        }
        Insert: {
          fallback_scraper?: boolean
          jitter_seconds?: number
          max_retries_per_card?: number
          notify_email?: boolean
          notify_in_app?: boolean
          notify_telegram?: boolean
          refresh_interval_minutes?: number
          requests_per_minute?: number
          telegram_chat_id?: string | null
          updated_at?: string
          use_proxies?: boolean
          user_id: string
        }
        Update: {
          fallback_scraper?: boolean
          jitter_seconds?: number
          max_retries_per_card?: number
          notify_email?: boolean
          notify_in_app?: boolean
          notify_telegram?: boolean
          refresh_interval_minutes?: number
          requests_per_minute?: number
          telegram_chat_id?: string | null
          updated_at?: string
          use_proxies?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
