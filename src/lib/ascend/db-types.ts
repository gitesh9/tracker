export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_key: string;
          id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          badge_key: string;
          id?: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          badge_key?: string;
          id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      deferral_logs: {
        Row: {
          id: string;
          logged_at: string;
          notes: string | null;
          reason_category: string;
          task_id: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          logged_at?: string;
          notes?: string | null;
          reason_category: string;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          logged_at?: string;
          notes?: string | null;
          reason_category?: string;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deferral_logs_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      focus_sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          minutes: number;
          mode: string;
          started_at: string;
          task_id: string | null;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          minutes?: number;
          mode?: string;
          started_at?: string;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          minutes?: number;
          mode?: string;
          started_at?: string;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          ai_split_accepted: boolean;
          created_at: string;
          description: string | null;
          domain: string;
          icon_name: string;
          id: string;
          is_completed: boolean;
          projected_completion_date: string | null;
          status: string;
          target_date: string | null;
          target_days: number;
          title: string;
          updated_at: string;
          user_id: string;
          workspace_id: string | null;
        };
        Insert: {
          ai_split_accepted?: boolean;
          created_at?: string;
          description?: string | null;
          domain?: string;
          icon_name?: string;
          id?: string;
          is_completed?: boolean;
          projected_completion_date?: string | null;
          status?: string;
          target_date?: string | null;
          target_days?: number;
          title: string;
          updated_at?: string;
          user_id: string;
          workspace_id?: string | null;
        };
        Update: {
          ai_split_accepted?: boolean;
          created_at?: string;
          description?: string | null;
          domain?: string;
          icon_name?: string;
          id?: string;
          is_completed?: boolean;
          projected_completion_date?: string | null;
          status?: string;
          target_date?: string | null;
          target_days?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goals_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ai_enabled: boolean;
          created_at: string;
          current_streak: number;
          display_name: string | null;
          email: string | null;
          id: string;
          last_active_date: string | null;
          longest_streak: number;
          streak_freezes: number;
          theme_preference: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          ai_enabled?: boolean;
          created_at?: string;
          current_streak?: number;
          display_name?: string | null;
          email?: string | null;
          id: string;
          last_active_date?: string | null;
          longest_streak?: number;
          streak_freezes?: number;
          theme_preference?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          ai_enabled?: boolean;
          created_at?: string;
          current_streak?: number;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          last_active_date?: string | null;
          longest_streak?: number;
          streak_freezes?: number;
          theme_preference?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_key: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth_key: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth_key?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          created_at: string;
          id: string;
          is_enabled: boolean;
          is_sent: boolean;
          label: string;
          remind_at: string;
          task_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          is_sent?: boolean;
          label?: string;
          remind_at?: string;
          task_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_enabled?: boolean;
          is_sent?: boolean;
          label?: string;
          remind_at?: string;
          task_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      subtasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          definition_of_done: string | null;
          estimated_minutes: number;
          goal_id: string | null;
          id: string;
          is_completed: boolean;
          parent_id: string | null;
          position: number;
          target_date: string | null;
          task_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          definition_of_done?: string | null;
          estimated_minutes?: number;
          goal_id?: string | null;
          id?: string;
          is_completed?: boolean;
          parent_id?: string | null;
          position?: number;
          target_date?: string | null;
          task_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          definition_of_done?: string | null;
          estimated_minutes?: number;
          goal_id?: string | null;
          id?: string;
          is_completed?: boolean;
          parent_id?: string | null;
          position?: number;
          target_date?: string | null;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subtasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subtasks_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "subtasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subtasks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          carry_forward_count: number;
          categories: string[];
          completed_dates: string[];
          created_at: string;
          definition_of_done: string | null;
          description: string | null;
          domain: string;
          due_date: string;
          energy_level: string;
          estimated_minutes: number;
          frequency_days: number | null;
          frequency_type: string;
          goal_id: string | null;
          icon_name: string;
          id: string;
          is_ai_enabled: boolean;
          is_completed: boolean;
          linked_task_ids: string[];
          notes: string | null;
          priority: string;
          scheduled_at: string | null;
          target_count: number;
          target_days_per_week: number;
          title: string;
          updated_at: string;
          user_id: string;
          weekdays: number[];
          workspace_id: string | null;
        };
        Insert: {
          carry_forward_count?: number;
          categories?: string[];
          completed_dates?: string[];
          created_at?: string;
          definition_of_done?: string | null;
          description?: string | null;
          domain?: string;
          due_date?: string;
          energy_level?: string;
          estimated_minutes?: number;
          frequency_days?: number | null;
          frequency_type?: string;
          goal_id?: string | null;
          icon_name?: string;
          id?: string;
          is_ai_enabled?: boolean;
          is_completed?: boolean;
          linked_task_ids?: string[];
          notes?: string | null;
          priority?: string;
          scheduled_at?: string | null;
          target_count?: number;
          target_days_per_week?: number;
          title: string;
          updated_at?: string;
          user_id: string;
          weekdays?: number[];
          workspace_id?: string | null;
        };
        Update: {
          carry_forward_count?: number;
          categories?: string[];
          completed_dates?: string[];
          created_at?: string;
          definition_of_done?: string | null;
          description?: string | null;
          domain?: string;
          due_date?: string;
          energy_level?: string;
          estimated_minutes?: number;
          frequency_days?: number | null;
          frequency_type?: string;
          goal_id?: string | null;
          icon_name?: string;
          id?: string;
          is_ai_enabled?: boolean;
          is_completed?: boolean;
          linked_task_ids?: string[];
          notes?: string | null;
          priority?: string;
          scheduled_at?: string | null;
          target_count?: number;
          target_days_per_week?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
          weekdays?: number[];
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          is_team: boolean;
          name: string;
          owner_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_team?: boolean;
          name?: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_team?: boolean;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
