import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please set up your Supabase connection.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please set up your Supabase connection.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string
          user_id: string
          title: string
          amount: number
          category: string
          description: string | null
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          amount: number
          category: string
          description?: string | null
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          amount?: number
          category?: string
          description?: string | null
          date?: string
          created_at?: string
        }
      }
      bill_splits: {
        Row: {
          id: string
          user_id: string
          title: string
          total_amount: number
          participants: string[]
          split_method: string
          split_data: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          total_amount: number
          participants: string[]
          split_method: string
          split_data: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          total_amount?: number
          participants?: string[]
          split_method?: string
          split_data?: any
          created_at?: string
        }
      }
      friends: {
        Row: {
          id: string
          user_id: string
          friend_email: string
          friend_name: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_email: string
          friend_name: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_email?: string
          friend_name?: string
          status?: string
          created_at?: string
        }
      }
      shared_expenses: {
        Row: {
          id: string
          created_by: string
          title: string
          description: string | null
          total_amount: number
          category: string
          date: string
          split_method: string
          currency: string
          receipt_url: string | null
          is_settled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          created_by: string
          title: string
          description?: string | null
          total_amount: number
          category: string
          date: string
          split_method: string
          currency?: string
          receipt_url?: string | null
          is_settled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          title?: string
          description?: string | null
          total_amount?: number
          category?: string
          date?: string
          split_method?: string
          currency?: string
          receipt_url?: string | null
          is_settled?: boolean
          created_at?: string
        }
      }
      expense_participants: {
        Row: {
          id: string
          shared_expense_id: string
          user_email: string
          user_name: string
          amount_owed: number
          amount_paid: number
          percentage: number | null
          shares: number | null
          is_settled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          shared_expense_id: string
          user_email: string
          user_name: string
          amount_owed: number
          amount_paid?: number
          percentage?: number | null
          shares?: number | null
          is_settled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          shared_expense_id?: string
          user_email?: string
          user_name?: string
          amount_owed?: number
          amount_paid?: number
          percentage?: number | null
          shares?: number | null
          is_settled?: boolean
          created_at?: string
        }
      }
      settlements: {
        Row: {
          id: string
          from_user_email: string
          to_user_email: string
          amount: number
          shared_expense_id: string | null
          description: string | null
          status: string
          settled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          from_user_email: string
          to_user_email: string
          amount: number
          shared_expense_id?: string | null
          description?: string | null
          status?: string
          settled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          from_user_email?: string
          to_user_email?: string
          amount?: number
          shared_expense_id?: string | null
          description?: string | null
          status?: string
          settled_at?: string | null
          created_at?: string
        }
      }
      expense_predictions: {
        Row: {
          id: string
          user_id: string
          prediction_date: string
          predicted_amount: number
          category: string | null
          confidence_score: number | null
          prediction_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prediction_date: string
          predicted_amount: number
          category?: string | null
          confidence_score?: number | null
          prediction_type: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          prediction_date?: string
          predicted_amount?: number
          category?: string | null
          confidence_score?: number | null
          prediction_type?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_balance: {
        Args: {
          user_email_param: string
        }
        Returns: {
          friend_email: string
          friend_name: string
          balance: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}