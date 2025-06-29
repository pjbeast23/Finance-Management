import { supabase } from './supabase'

export interface Investment {
  id: string
  user_id: string
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
}

export interface InvestmentTransaction {
  id: string
  investment_id: string
  transaction_type: 'buy' | 'sell'
  quantity: number
  price_per_share: number
  total_amount: number
  transaction_date: string
  fees: number
  notes?: string
  created_at: string
}

export interface InvestmentSummary {
  totalValue: number
  totalInvested: number
  totalGainLoss: number
  totalGainLossPercent: number
  topPerformer: Investment | null
  worstPerformer: Investment | null
}

export interface PriceUpdateResult {
  symbol: string
  oldPrice: number
  newPrice: number
  change: number
  changePercent: number
  success: boolean
  error?: string
}

export class InvestmentService {
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  async getInvestments(): Promise<Investment[]> {
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getInvestment(id: string): Promise<Investment> {
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async createInvestment(investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Investment> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('investments')
      .insert({
        ...investment,
        user_id: user.user.id,
        current_price: investment.purchase_price // Initially set current price to purchase price
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateInvestment(id: string, updates: Partial<Investment>): Promise<Investment> {
    const { data, error } = await supabase
      .from('investments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteInvestment(id: string): Promise<void> {
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getInvestmentTransactions(investmentId: string): Promise<InvestmentTransaction[]> {
    const { data, error } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('investment_id', investmentId)
      .order('transaction_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  async createTransaction(transaction: Omit<InvestmentTransaction, 'id' | 'created_at'>): Promise<InvestmentTransaction> {
    const { data, error } = await supabase
      .from('investment_transactions')
      .insert(transaction)
      .select()
      .single()

    if (error) throw error

    // Update investment quantity based on transaction
    await this.updateInvestmentQuantity(transaction.investment_id)

    return data
  }

  private async updateInvestmentQuantity(investmentId: string): Promise<void> {
    // Get all transactions for this investment
    const transactions = await this.getInvestmentTransactions(investmentId)
    
    // Calculate total quantity
    let totalQuantity = 0
    transactions.forEach(transaction => {
      if (transaction.transaction_type === 'buy') {
        totalQuantity += transaction.quantity
      } else {
        totalQuantity -= transaction.quantity
      }
    })

    // Update investment quantity
    await supabase
      .from('investments')
      .update({ 
        quantity: Math.max(0, totalQuantity),
        updated_at: new Date().toISOString()
      })
      .eq('id', investmentId)
  }

  // Update prices using server-side edge function
  async updatePricesFromAlphaVantage(): Promise<PriceUpdateResult[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-stock-prices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle specific error cases with user-friendly messages
        if (response.status === 503) {
          throw new Error(result.error || 'Price update service is temporarily unavailable')
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.')
        } else {
          throw new Error(result.error || `Server error (${response.status}). Please try again later.`)
        }
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update prices')
      }

      return result.results || []
    } catch (error) {
      console.error('Error updating prices:', error)
      throw error
    }
  }

  async getInvestmentSummary(): Promise<InvestmentSummary> {
    const investments = await this.getInvestments()
    
    let totalValue = 0
    let totalInvested = 0
    let topPerformer: Investment | null = null
    let worstPerformer: Investment | null = null
    let maxGainPercent = -Infinity
    let minGainPercent = Infinity

    investments.forEach(investment => {
      const currentValue = investment.quantity * investment.current_price
      const investedValue = investment.quantity * investment.purchase_price
      const gainLoss = currentValue - investedValue
      const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0

      totalValue += currentValue
      totalInvested += investedValue

      if (gainLossPercent > maxGainPercent) {
        maxGainPercent = gainLossPercent
        topPerformer = investment
      }

      if (gainLossPercent < minGainPercent) {
        minGainPercent = gainLossPercent
        worstPerformer = investment
      }
    })

    const totalGainLoss = totalValue - totalInvested
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0

    return {
      totalValue,
      totalInvested,
      totalGainLoss,
      totalGainLossPercent,
      topPerformer,
      worstPerformer
    }
  }

  // Search for stock symbols using server-side edge function
  async searchSymbol(keywords: string): Promise<any[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-stocks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords })
      })

      if (!response.ok) {
        // If the function fails, return empty results instead of throwing
        console.warn(`Search function returned ${response.status}, returning empty results`)
        return []
      }

      const result = await response.json()
      return result.results || []
    } catch (error) {
      console.error('Error searching symbols:', error)
      // Return empty results instead of throwing to prevent UI errors
      return []
    }
  }

  // Validate if a symbol exists using server-side edge function
  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-stock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol })
      })

      if (!response.ok) {
        // If validation fails due to server error, assume symbol is valid
        console.warn(`Validation function returned ${response.status}, assuming symbol is valid`)
        return true
      }

      const result = await response.json()
      return result.valid || false
    } catch (error) {
      console.error(`Error validating symbol ${symbol}:`, error)
      // If validation fails, assume symbol is valid to not block user
      return true
    }
  }
}