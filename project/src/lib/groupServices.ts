import { supabase } from './supabase'
import { Group } from '../contexts/GroupContext'

export interface GroupExpense {
  id: string
  group_id: string
  created_by: string
  title: string
  amount: number
  category: string
  description?: string
  date: string
  created_at: string
  creator_name?: string
}

export interface GroupInvestment {
  id: string
  group_id: string
  created_by: string
  symbol: string
  name: string
  quantity: number
  purchase_price: number
  current_price: number
  purchase_date: string
  investment_type: 'stock' | 'bond' | 'crypto' | 'etf' | 'mutual_fund' | 'other'
  notes?: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export interface GroupStats {
  totalExpenses: number
  monthlyExpenses: number
  expenseCount: number
  totalInvestments: number
  portfolioValue: number
  investmentCount: number
  memberCount: number
}

export class GroupExpenseService {
  async getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
    const { data, error } = await supabase
      .from('group_expenses')
      .select(`
        *,
        creator:created_by(email)
      `)
      .eq('group_id', groupId)
      .order('date', { ascending: false })

    if (error) throw error
    
    return (data || []).map(expense => ({
      ...expense,
      creator_name: expense.creator?.email?.split('@')[0] || 'Unknown'
    }))
  }

  async createGroupExpense(groupId: string, expense: Omit<GroupExpense, 'id' | 'group_id' | 'created_by' | 'created_at'>): Promise<GroupExpense> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('group_expenses')
      .insert({
        ...expense,
        group_id: groupId,
        created_by: user.user.id,
        date: new Date(expense.date).toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateGroupExpense(expenseId: string, updates: Partial<GroupExpense>): Promise<void> {
    const { error } = await supabase
      .from('group_expenses')
      .update(updates)
      .eq('id', expenseId)

    if (error) throw error
  }

  async deleteGroupExpense(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('group_expenses')
      .delete()
      .eq('id', expenseId)

    if (error) throw error
  }
}

export class GroupInvestmentService {
  async getGroupInvestments(groupId: string): Promise<GroupInvestment[]> {
    const { data, error } = await supabase
      .from('group_investments')
      .select(`
        *,
        creator:created_by(email)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })

    if (error) throw error
    
    return (data || []).map(investment => ({
      ...investment,
      creator_name: investment.creator?.email?.split('@')[0] || 'Unknown'
    }))
  }

  async createGroupInvestment(groupId: string, investment: Omit<GroupInvestment, 'id' | 'group_id' | 'created_by' | 'created_at' | 'updated_at'>): Promise<GroupInvestment> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('group_investments')
      .insert({
        ...investment,
        group_id: groupId,
        created_by: user.user.id,
        current_price: investment.purchase_price, // Initially set current price to purchase price
        purchase_date: new Date(investment.purchase_date).toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateGroupInvestment(investmentId: string, updates: Partial<GroupInvestment>): Promise<void> {
    const { error } = await supabase
      .from('group_investments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', investmentId)

    if (error) throw error
  }

  async deleteGroupInvestment(investmentId: string): Promise<void> {
    const { error } = await supabase
      .from('group_investments')
      .delete()
      .eq('id', investmentId)

    if (error) throw error
  }

  async updateGroupInvestmentPrices(groupId: string): Promise<void> {
    // Get unique symbols for this group
    const { data: investments, error } = await supabase
      .from('group_investments')
      .select('id, symbol, current_price')
      .eq('group_id', groupId)

    if (error) throw error
    if (!investments || investments.length === 0) return

    // Use the same price update logic as personal investments
    // This would call the same edge function but filter by group
    const symbols = [...new Set(investments.map(inv => inv.symbol))]
    
    for (const symbol of symbols) {
      try {
        // Fetch current price (simplified - in real implementation, use Alpha Vantage)
        const mockPrice = Math.random() * 200 + 50 // Mock price for demo
        
        // Update all investments with this symbol in the group
        const symbolInvestments = investments.filter(inv => inv.symbol === symbol)
        
        for (const investment of symbolInvestments) {
          await supabase
            .from('group_investments')
            .update({
              current_price: mockPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', investment.id)
        }
      } catch (error) {
        console.error(`Error updating price for ${symbol}:`, error)
      }
    }
  }
}

export class GroupStatsService {
  async getGroupStats(groupId: string): Promise<GroupStats> {
    const [expensesData, investmentsData, membersData] = await Promise.all([
      supabase
        .from('group_expenses')
        .select('amount, date')
        .eq('group_id', groupId),
      supabase
        .from('group_investments')
        .select('quantity, current_price, purchase_price')
        .eq('group_id', groupId),
      supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('status', 'active')
    ])

    const expenses = expensesData.data || []
    const investments = investmentsData.data || []
    const memberCount = membersData.count || 0

    // Calculate expense stats
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    const monthlyExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date)
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear
      })
      .reduce((sum, expense) => sum + expense.amount, 0)

    // Calculate investment stats
    const portfolioValue = investments.reduce((sum, investment) => 
      sum + (investment.quantity * investment.current_price), 0)
    const totalInvestments = investments.reduce((sum, investment) => 
      sum + (investment.quantity * investment.purchase_price), 0)

    return {
      totalExpenses,
      monthlyExpenses,
      expenseCount: expenses.length,
      totalInvestments,
      portfolioValue,
      investmentCount: investments.length,
      memberCount
    }
  }
}