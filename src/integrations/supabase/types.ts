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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      closed_dates: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          accent_color: string | null
          allowed_domain: string
          created_at: string
          id: string
          primary_color: string | null
          reminder_day: number
          reminder_enabled: boolean
          reminder_hour: number
          secondary_color: string | null
          updated_at: string
          weeks_to_display: number
        }
        Insert: {
          accent_color?: string | null
          allowed_domain: string
          created_at?: string
          id?: string
          primary_color?: string | null
          reminder_day?: number
          reminder_enabled?: boolean
          reminder_hour?: number
          secondary_color?: string | null
          updated_at?: string
          weeks_to_display?: number
        }
        Update: {
          accent_color?: string | null
          allowed_domain?: string
          created_at?: string
          id?: string
          primary_color?: string | null
          reminder_day?: number
          reminder_enabled?: boolean
          reminder_hour?: number
          secondary_color?: string | null
          updated_at?: string
          weeks_to_display?: number
        }
        Relationships: []
      }
      cron_settings: {
        Row: {
          created_at: string | null
          id: string
          setting_key: string
          setting_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string
          id: string
          is_gluten_free: boolean
          is_lactose_free: boolean
          is_vegetarian: boolean
          signup_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          signup_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          signup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_signup_id_fkey"
            columns: ["signup_id"]
            isOneToOne: false
            referencedRelation: "lunch_signups"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_batches: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          total_invites: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          total_invites?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          total_invites?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          batch_id: string | null
          email: string
          expires_at: string
          id: string
          invite_code: string
          invited_at: string
          invited_by: string
          link_sent_at: string | null
          status: string
          used_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          batch_id?: string | null
          email: string
          expires_at: string
          id?: string
          invite_code: string
          invited_at?: string
          invited_by: string
          link_sent_at?: string | null
          status?: string
          used_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          batch_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_at?: string
          invited_by?: string
          link_sent_at?: string | null
          status?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "invitation_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      lunch_optouts: {
        Row: {
          created_at: string | null
          id: string
          lunch_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lunch_date: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lunch_date?: string
          user_id?: string
        }
        Relationships: []
      }
      lunch_signups: {
        Row: {
          created_at: string
          guest_count: number
          id: string
          lunch_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guest_count?: number
          id?: string
          lunch_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          guest_count?: number
          id?: string
          lunch_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lunch_signups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          is_gluten_free: boolean
          is_lactose_free: boolean
          is_vegetarian: boolean
          updated_at: string
          webflow_id: string | null
          webflow_synced: boolean
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          updated_at?: string
          webflow_id?: string | null
          webflow_synced?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          updated_at?: string
          webflow_id?: string | null
          webflow_synced?: boolean
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          created_at: string
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          status: string
          sync_completed_at: string | null
          sync_started_at: string
          users_added: number
          users_removed: number
          users_updated: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          users_added?: number
          users_removed?: number
          users_updated?: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          status?: string
          sync_completed_at?: string | null
          sync_started_at?: string
          users_added?: number
          users_removed?: number
          users_updated?: number
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      webflow_sync_settings: {
        Row: {
          collection_id: string
          created_at: string
          field_mapping: Json
          id: string
          include_drafts: boolean
          is_enabled: boolean
          last_sync_at: string | null
          removal_policy: string
          site_id: string
          sync_frequency: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          field_mapping?: Json
          id?: string
          include_drafts?: boolean
          is_enabled?: boolean
          last_sync_at?: string | null
          removal_policy?: string
          site_id: string
          sync_frequency?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          field_mapping?: Json
          id?: string
          include_drafts?: boolean
          is_enabled?: boolean
          last_sync_at?: string | null
          removal_policy?: string
          site_id?: string
          sync_frequency?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      expire_old_invitations: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "kitchen"
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
      app_role: ["admin", "user", "kitchen"],
    },
  },
} as const
