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
      catering_orders: {
        Row: {
          catering_types: string[]
          comment: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          dietary_notes: string | null
          id: string
          meeting_date: string
          meeting_external_id: string | null
          meeting_location: string | null
          meeting_subject: string
          meeting_time: string
          person_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catering_types?: string[]
          comment?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          dietary_notes?: string | null
          id?: string
          meeting_date: string
          meeting_external_id?: string | null
          meeting_location?: string | null
          meeting_subject: string
          meeting_time: string
          person_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catering_types?: string[]
          comment?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          dietary_notes?: string | null
          id?: string
          meeting_date?: string
          meeting_external_id?: string | null
          meeting_location?: string | null
          meeting_subject?: string
          meeting_time?: string
          person_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      companies: {
        Row: {
          accent_color: string | null
          allowed_domain: string
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          allowed_domain: string
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          allowed_domain?: string
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_modules: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          updated_at: string
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          accent_color: string | null
          allowed_domain: string
          allowed_locations: string[]
          created_at: string
          id: string
          primary_color: string | null
          reminder_day: number
          reminder_enabled: boolean
          reminder_hour: number
          resource_room_emails: string[]
          restrict_signup_to_domain: boolean
          secondary_color: string | null
          updated_at: string
          weeks_to_display: number
        }
        Insert: {
          accent_color?: string | null
          allowed_domain: string
          allowed_locations?: string[]
          created_at?: string
          id?: string
          primary_color?: string | null
          reminder_day?: number
          reminder_enabled?: boolean
          reminder_hour?: number
          resource_room_emails?: string[]
          restrict_signup_to_domain?: boolean
          secondary_color?: string | null
          updated_at?: string
          weeks_to_display?: number
        }
        Update: {
          accent_color?: string | null
          allowed_domain?: string
          allowed_locations?: string[]
          created_at?: string
          id?: string
          primary_color?: string | null
          reminder_day?: number
          reminder_enabled?: boolean
          reminder_hour?: number
          resource_room_emails?: string[]
          restrict_signup_to_domain?: boolean
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      graph_subscriptions: {
        Row: {
          client_state: string | null
          created_at: string
          expires_at: string
          id: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_state?: string | null
          created_at?: string
          expires_at: string
          id?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_state?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          catering_order_id: string | null
          created_at: string
          id: string
          is_gluten_free: boolean
          is_lactose_free: boolean
          is_vegetarian: boolean
          signup_id: string
        }
        Insert: {
          catering_order_id?: string | null
          created_at?: string
          id?: string
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          signup_id: string
        }
        Update: {
          catering_order_id?: string | null
          created_at?: string
          id?: string
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          signup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_catering_order_id_fkey"
            columns: ["catering_order_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
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
      kitchen_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          order_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          order_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          order_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
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
          marked_absent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          guest_count?: number
          id?: string
          lunch_date: string
          marked_absent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          guest_count?: number
          id?: string
          lunch_date?: string
          marked_absent_at?: string | null
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
      microsoft_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          is_gluten_free: boolean
          is_lactose_free: boolean
          is_vegetarian: boolean
          reminder_enabled: boolean
          updated_at: string
          webflow_id: string | null
          webflow_synced: boolean
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          reminder_enabled?: boolean
          updated_at?: string
          webflow_id?: string | null
          webflow_synced?: boolean
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_gluten_free?: boolean
          is_lactose_free?: boolean
          is_vegetarian?: boolean
          reminder_enabled?: boolean
          updated_at?: string
          webflow_id?: string | null
          webflow_synced?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      signup_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          lunch_date: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          lunch_date: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          lunch_date?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          type?: string
          user_id?: string
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
      vapid_keys: {
        Row: {
          application_server_key: string
          created_at: string
          id: string
          private_key_jwk: Json
          public_key_jwk: Json
        }
        Insert: {
          application_server_key: string
          created_at?: string
          id?: string
          private_key_jwk: Json
          public_key_jwk: Json
        }
        Update: {
          application_server_key?: string
          created_at?: string
          id?: string
          private_key_jwk?: Json
          public_key_jwk?: Json
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
      cleanup_old_lunch_data: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_old_invitations: { Args: never; Returns: undefined }
      get_active_user_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reschedule_weekly_reminder: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "kitchen" | "platform_admin"
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
      app_role: ["admin", "user", "kitchen", "platform_admin"],
    },
  },
} as const
