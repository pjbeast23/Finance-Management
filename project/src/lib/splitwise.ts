import { supabase } from './supabase'

export interface Friend {
  id: string
  user_id: string
  friend_email: string
  friend_name: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
}

export interface SharedExpense {
  id: string
  created_by: string
  title: string
  description?: string
  total_amount: number
  category: string
  date: string
  split_method: 'equal' | 'percentage' | 'custom' | 'shares'
  currency: string
  receipt_url?: string
  is_settled: boolean
  participants: ExpenseParticipant[]
  created_at: string
  group_id?: string // NEW: Optional group association
}

export interface ExpenseParticipant {
  id: string
  shared_expense_id: string
  user_email: string
  user_name: string
  amount_owed: number
  amount_paid: number
  percentage?: number
  shares?: number
  is_settled: boolean
}

export interface Settlement {
  id: string
  from_user_email: string
  to_user_email: string
  amount: number
  shared_expense_id?: string
  description?: string
  status: 'pending' | 'completed' | 'cancelled'
  settled_at?: string
  created_at: string
}

export interface UserBalance {
  friend_email: string
  friend_name: string
  balance: number // positive = they owe you, negative = you owe them
}

export interface EmailNotification {
  to_email: string
  to_name: string
  from_name: string
  expense_title: string
  expense_description?: string
  total_amount: number
  amount_owed: number
  expense_date: string
  split_method: string
}

export interface SettlementNotification {
  to_email: string
  to_name: string
  from_name: string
  amount: number
  expense_title: string
  payment_method: string
  notes?: string
}

export class SplitwiseService {
  async addFriend(friendEmail: string, friendName: string): Promise<Friend> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: user.user.id,
        friend_email: friendEmail,
        friend_name: friendName,
        status: 'accepted' // Auto-accept for simplicity
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getFriends(): Promise<Friend[]> {
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .eq('status', 'accepted')
      .order('friend_name')

    if (error) throw error
    return data || []
  }

  async createSharedExpense(expense: {
    title: string
    description?: string
    total_amount: number
    category: string
    date: string
    split_method: 'equal' | 'percentage' | 'custom' | 'shares'
    participants: {
      user_email: string
      user_name: string
      amount_owed?: number
      percentage?: number
      shares?: number
    }[]
    group_id?: string // NEW: Optional group ID
  }): Promise<SharedExpense> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    // Create the shared expense with optional group_id
    const { data: sharedExpense, error: expenseError } = await supabase
      .from('shared_expenses')
      .insert({
        created_by: user.user.id,
        title: expense.title,
        description: expense.description,
        total_amount: expense.total_amount,
        category: expense.category,
        date: expense.date,
        split_method: expense.split_method,
        currency: 'USD',
        group_id: expense.group_id || null // Store group association
      })
      .select()
      .single()

    if (expenseError) throw expenseError

    // Calculate amounts based on split method
    const participants = this.calculateParticipantAmounts(
      expense.participants,
      expense.total_amount,
      expense.split_method
    )

    // Create participant records
    const participantData = participants.map(p => ({
      shared_expense_id: sharedExpense.id,
      user_email: p.user_email,
      user_name: p.user_name,
      amount_owed: p.amount_owed || 0,
      percentage: p.percentage,
      shares: p.shares
    }))

    const { error: participantError } = await supabase
      .from('expense_participants')
      .insert(participantData)

    if (participantError) throw participantError

    // Send email notifications to all participants (except the creator)
    const currentUserEmail = user.user.email
    const fromName = currentUserEmail?.split('@')[0] || 'Someone'
    
    for (const participant of participants) {
      if (participant.user_email !== currentUserEmail) {
        try {
          await this.sendExpenseNotification({
            to_email: participant.user_email,
            to_name: participant.user_name,
            from_name: fromName,
            expense_title: expense.title,
            expense_description: expense.description,
            total_amount: expense.total_amount,
            amount_owed: participant.amount_owed || 0,
            expense_date: expense.date,
            split_method: expense.split_method
          })
        } catch (emailError) {
          console.warn(`Email notification failed for ${participant.user_email}:`, emailError)
          // Don't throw error for email failures, just log them
        }
      }
    }

    return await this.getSharedExpense(sharedExpense.id)
  }

  async updateSharedExpense(expenseId: string, expense: {
    title: string
    description?: string
    total_amount: number
    category: string
    date: string
    split_method: 'equal' | 'percentage' | 'custom' | 'shares'
    participants: {
      user_email: string
      user_name: string
      amount_owed?: number
      percentage?: number
      shares?: number
    }[]
    group_id?: string // NEW: Optional group ID
  }): Promise<SharedExpense> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    // Update the shared expense with optional group_id
    const { error: expenseError } = await supabase
      .from('shared_expenses')
      .update({
        title: expense.title,
        description: expense.description,
        total_amount: expense.total_amount,
        category: expense.category,
        date: expense.date,
        split_method: expense.split_method,
        group_id: expense.group_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', expenseId)
      .eq('created_by', user.user.id)

    if (expenseError) throw expenseError

    // Delete existing participants
    const { error: deleteError } = await supabase
      .from('expense_participants')
      .delete()
      .eq('shared_expense_id', expenseId)

    if (deleteError) throw deleteError

    // Calculate amounts based on split method
    const participants = this.calculateParticipantAmounts(
      expense.participants,
      expense.total_amount,
      expense.split_method
    )

    // Create new participant records
    const participantData = participants.map(p => ({
      shared_expense_id: expenseId,
      user_email: p.user_email,
      user_name: p.user_name,
      amount_owed: p.amount_owed || 0,
      percentage: p.percentage,
      shares: p.shares
    }))

    const { error: participantError } = await supabase
      .from('expense_participants')
      .insert(participantData)

    if (participantError) throw participantError

    return await this.getSharedExpense(expenseId)
  }

  async deleteSharedExpense(expenseId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('shared_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('created_by', user.user.id)

    if (error) throw error
  }

  private calculateParticipantAmounts(
    participants: any[],
    totalAmount: number,
    splitMethod: string
  ): any[] {
    switch (splitMethod) {
      case 'equal':
        const equalAmount = totalAmount / participants.length
        return participants.map(p => ({
          ...p,
          amount_owed: equalAmount
        }))

      case 'percentage':
        return participants.map(p => ({
          ...p,
          amount_owed: (totalAmount * (p.percentage || 0)) / 100
        }))

      case 'shares':
        const totalShares = participants.reduce((sum, p) => sum + (p.shares || 1), 0)
        return participants.map(p => ({
          ...p,
          amount_owed: (totalAmount * (p.shares || 1)) / totalShares
        }))

      case 'custom':
        return participants.map(p => ({
          ...p,
          amount_owed: p.amount_owed || 0
        }))

      default:
        return participants
    }
  }

  async getSharedExpenses(): Promise<SharedExpense[]> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('shared_expenses')
      .select(`
        *,
        expense_participants (*)
      `)
      .order('date', { ascending: false })

    if (error) throw error

    return data?.map(expense => ({
      ...expense,
      participants: expense.expense_participants || []
    })) || []
  }

  async getSharedExpense(id: string): Promise<SharedExpense> {
    const { data, error } = await supabase
      .from('shared_expenses')
      .select(`
        *,
        expense_participants (*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return {
      ...data,
      participants: data.expense_participants || []
    }
  }

  async getUserBalances(): Promise<UserBalance[]> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user?.email) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .rpc('calculate_user_balance', { user_email_param: user.user.email })

    if (error) throw error
    return data || []
  }

  async settleExpense(participantId: string, amount: number): Promise<void> {
    const { error } = await supabase
      .from('expense_participants')
      .update({
        amount_paid: amount,
        is_settled: true
      })
      .eq('id', participantId)

    if (error) throw error
  }

  async createSettlement(settlement: {
    to_user_email: string
    amount: number
    shared_expense_id?: string
    description?: string
  }): Promise<Settlement> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user?.email) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('settlements')
      .insert({
        from_user_email: user.user.email,
        to_user_email: settlement.to_user_email,
        amount: settlement.amount,
        shared_expense_id: settlement.shared_expense_id,
        description: settlement.description,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getSettlements(): Promise<Settlement[]> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user?.email) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .or(`from_user_email.eq.${user.user.email},to_user_email.eq.${user.user.email}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async markSettlementComplete(settlementId: string): Promise<void> {
    const { error } = await supabase
      .from('settlements')
      .update({
        status: 'completed',
        settled_at: new Date().toISOString()
      })
      .eq('id', settlementId)

    if (error) throw error
  }

  // Email notification methods
  async sendExpenseNotification(notification: EmailNotification): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-expense-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send notification')
      }
    } catch (error) {
      console.error('Error sending expense notification:', error)
      throw error
    }
  }

  async sendSettlementNotification(notification: SettlementNotification): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-settlement-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send settlement notification')
      }
    } catch (error) {
      console.error('Error sending settlement notification:', error)
      throw error
    }
  }
}