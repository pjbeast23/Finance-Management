import { supabase } from './supabase'
import { addDays, subDays, format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'

export interface ExpensePrediction {
  date: string
  predictedAmount: number
  category?: string
  confidence: number
  type: 'daily' | 'weekly' | 'monthly' | 'category'
}

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable'
  changePercent: number
  averageDaily: number
  averageWeekly: number
  averageMonthly: number
}

export class ExpensePredictor {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async analyzeSpendingTrends(): Promise<TrendAnalysis> {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, date, category')
      .eq('user_id', this.userId)
      .gte('date', subDays(new Date(), 90).toISOString())
      .order('date', { ascending: true })

    if (!expenses || expenses.length < 7) {
      return {
        trend: 'stable',
        changePercent: 0,
        averageDaily: 0,
        averageWeekly: 0,
        averageMonthly: 0
      }
    }

    // Calculate daily averages for different periods
    const recent30Days = expenses.filter(e => 
      new Date(e.date) >= subDays(new Date(), 30)
    )
    const previous30Days = expenses.filter(e => 
      new Date(e.date) >= subDays(new Date(), 60) &&
      new Date(e.date) < subDays(new Date(), 30)
    )

    const recentAvg = recent30Days.reduce((sum, e) => sum + e.amount, 0) / 30
    const previousAvg = previous30Days.reduce((sum, e) => sum + e.amount, 0) / 30

    const changePercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? 'increasing' : 'decreasing'
    }

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)
    const totalDays = differenceInDays(new Date(), new Date(expenses[0].date))

    return {
      trend,
      changePercent,
      averageDaily: totalAmount / Math.max(totalDays, 1),
      averageWeekly: (totalAmount / Math.max(totalDays, 1)) * 7,
      averageMonthly: (totalAmount / Math.max(totalDays, 1)) * 30
    }
  }

  async predictMonthlyExpense(): Promise<ExpensePrediction> {
    const trends = await this.analyzeSpendingTrends()
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
    const daysPassed = differenceInDays(now, monthStart) + 1

    // Get current month expenses
    const { data: currentMonthExpenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', this.userId)
      .gte('date', monthStart.toISOString())
      .lte('date', now.toISOString())

    const currentSpent = currentMonthExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0
    const dailyAverage = currentSpent / daysPassed
    const remainingDays = daysInMonth - daysPassed
    
    // Apply trend adjustment
    let trendMultiplier = 1
    if (trends.trend === 'increasing') {
      trendMultiplier = 1 + (Math.abs(trends.changePercent) / 100) * 0.5
    } else if (trends.trend === 'decreasing') {
      trendMultiplier = 1 - (Math.abs(trends.changePercent) / 100) * 0.5
    }

    const predictedRemaining = dailyAverage * remainingDays * trendMultiplier
    const totalPredicted = currentSpent + predictedRemaining

    // Calculate confidence based on data availability and trend stability
    let confidence = 0.7
    if (daysPassed >= 7) confidence += 0.1
    if (daysPassed >= 15) confidence += 0.1
    if (Math.abs(trends.changePercent) < 10) confidence += 0.1

    return {
      date: format(monthEnd, 'yyyy-MM-dd'),
      predictedAmount: totalPredicted,
      confidence: Math.min(confidence, 0.95),
      type: 'monthly'
    }
  }

  async predictCategoryExpenses(): Promise<ExpensePrediction[]> {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, date, category')
      .eq('user_id', this.userId)
      .gte('date', subDays(new Date(), 60).toISOString())

    if (!expenses || expenses.length === 0) return []

    const categoryTotals: { [key: string]: number[] } = {}
    
    // Group expenses by category and week
    expenses.forEach(expense => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = []
      }
      categoryTotals[expense.category].push(expense.amount)
    })

    const predictions: ExpensePrediction[] = []
    const nextMonth = addDays(new Date(), 30)

    Object.entries(categoryTotals).forEach(([category, amounts]) => {
      if (amounts.length >= 3) {
        const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length
        const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / amounts.length
        const confidence = Math.max(0.3, 1 - (Math.sqrt(variance) / average))

        predictions.push({
          date: format(nextMonth, 'yyyy-MM-dd'),
          predictedAmount: average * 4, // Monthly prediction
          category,
          confidence: Math.min(confidence, 0.9),
          type: 'category'
        })
      }
    })

    return predictions.sort((a, b) => b.predictedAmount - a.predictedAmount)
  }

  async savePredictions(predictions: ExpensePrediction[]): Promise<void> {
    const predictionData = predictions.map(pred => ({
      user_id: this.userId,
      prediction_date: pred.date,
      predicted_amount: pred.predictedAmount,
      category: pred.category,
      confidence_score: pred.confidence,
      prediction_type: pred.type
    }))

    await supabase
      .from('expense_predictions')
      .upsert(predictionData, { 
        onConflict: 'user_id,prediction_date,prediction_type,category' 
      })
  }

  async generateAllPredictions(): Promise<{
    monthly: ExpensePrediction
    categories: ExpensePrediction[]
    trends: TrendAnalysis
  }> {
    const [monthly, categories, trends] = await Promise.all([
      this.predictMonthlyExpense(),
      this.predictCategoryExpenses(),
      this.analyzeSpendingTrends()
    ])

    // Save predictions to database
    await this.savePredictions([monthly, ...categories])

    return { monthly, categories, trends }
  }
}