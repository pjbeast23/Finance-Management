import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { supabase } from '../lib/supabase'
import { InvestmentService } from '../lib/investments'
import { GroupStatsService, GroupExpenseService, GroupInvestmentService } from '../lib/groupServices'
import { SplitwiseService } from '../lib/splitwise'
import { CreditCard, TrendingUp, Users, Calendar, Plus, Brain, DollarSign } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import ExpenseChart from '../components/Charts/ExpenseChart'
import CategoryChart from '../components/Charts/CategoryChart'
import ExpensePredictions from '../components/Predictions/ExpensePredictions'
import LoadingSpinner from '../components/UI/LoadingSpinner'

interface DashboardStats {
  totalExpenses: number
  monthlyExpenses: number
  expenseCount: number
  avgExpense: number
  sharedExpenses: number
  totalShared: number
  portfolioValue: number
  investmentCount: number
  memberCount?: number
}

const Dashboard = () => {
  const { user } = useAuth()
  const { isGroupMode, currentGroup } = useGroup()
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    monthlyExpenses: 0,
    expenseCount: 0,
    avgExpense: 0,
    sharedExpenses: 0,
    totalShared: 0,
    portfolioValue: 0,
    investmentCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [recentExpenses, setRecentExpenses] = useState<any[]>([])
  const [showPredictions, setShowPredictions] = useState(false)

  const investmentService = new InvestmentService()
  const groupStatsService = new GroupStatsService()
  const groupExpenseService = new GroupExpenseService()
  const splitwiseService = new SplitwiseService()

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user, isGroupMode, currentGroup])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Reset stats when switching modes
      setStats({
        totalExpenses: 0,
        monthlyExpenses: 0,
        expenseCount: 0,
        avgExpense: 0,
        sharedExpenses: 0,
        totalShared: 0,
        portfolioValue: 0,
        investmentCount: 0
      })
      setRecentExpenses([])

      if (isGroupMode && currentGroup) {
        // Fetch GROUP data ONLY
        const [groupStats, groupExpenses] = await Promise.all([
          groupStatsService.getGroupStats(currentGroup.id),
          groupExpenseService.getGroupExpenses(currentGroup.id)
        ])

        setStats({
          totalExpenses: groupStats.totalExpenses,
          monthlyExpenses: groupStats.monthlyExpenses,
          expenseCount: groupStats.expenseCount,
          avgExpense: groupStats.expenseCount > 0 ? groupStats.totalExpenses / groupStats.expenseCount : 0,
          sharedExpenses: 0, // Not applicable for group mode
          totalShared: 0, // Not applicable for group mode
          portfolioValue: groupStats.portfolioValue,
          investmentCount: groupStats.investmentCount,
          memberCount: groupStats.memberCount
        })

        setRecentExpenses(groupExpenses.slice(0, 5))
      } else {
        // Fetch PERSONAL data ONLY (completely separate from groups and splitwise)
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)

        // Fetch ONLY personal expenses (not group or shared expenses)
        const { data: allExpenses, error: allError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })

        if (allError) throw allError

        // Fetch ONLY personal monthly expenses
        const { data: monthlyExpenses, error: monthlyError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user!.id)
          .gte('date', monthStart.toISOString())
          .lte('date', monthEnd.toISOString())

        if (monthlyError) throw monthlyError

        // Fetch ONLY splitwise shared expenses (separate from group expenses)
        const sharedExpenses = await splitwiseService.getSharedExpenses()
        const userSharedExpenses = sharedExpenses.filter(expense => expense.created_by === user!.id)

        // Fetch ONLY personal investment data
        const [investments, investmentSummary] = await Promise.all([
          investmentService.getInvestments(),
          investmentService.getInvestmentSummary()
        ])

        const totalExpenses = allExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const avgExpense = allExpenses.length > 0 ? totalExpenses / allExpenses.length : 0
        const totalShared = userSharedExpenses.reduce((sum, expense) => sum + expense.total_amount, 0)

        setStats({
          totalExpenses,
          monthlyExpenses: monthlyTotal,
          expenseCount: allExpenses.length,
          avgExpense,
          sharedExpenses: userSharedExpenses.length,
          totalShared,
          portfolioValue: investmentSummary.totalValue,
          investmentCount: investments.length
        })

        setRecentExpenses(allExpenses.slice(0, 5))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const getStatCards = () => {
    const baseCards = [
      {
        title: isGroupMode ? 'Group Expenses' : 'Personal Expenses',
        value: `$${stats.totalExpenses.toFixed(2)}`,
        icon: CreditCard,
        color: 'text-primary-600 bg-primary-50'
      },
      {
        title: 'This Month',
        value: `$${stats.monthlyExpenses.toFixed(2)}`,
        icon: Calendar,
        color: 'text-success-600 bg-success-50'
      },
      {
        title: isGroupMode ? 'Group Portfolio' : 'Personal Portfolio',
        value: `$${stats.portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        icon: TrendingUp,
        color: 'text-warning-600 bg-warning-50'
      }
    ]

    if (isGroupMode && currentGroup) {
      baseCards.push({
        title: 'Group Members',
        value: `${stats.memberCount || 0}`,
        icon: Users,
        color: 'text-error-600 bg-error-50'
      })
    } else {
      baseCards.push({
        title: 'Splitwise Expenses',
        value: `$${stats.totalShared.toFixed(2)}`,
        icon: Users,
        color: 'text-error-600 bg-error-50'
      })
    }

    return baseCards
  }

  const statCards = getStatCards()

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isGroupMode && currentGroup ? `${currentGroup.name} Dashboard` : 'Personal Dashboard'}
          </h1>
          {isGroupMode && currentGroup && (
            <p className="text-gray-600 mt-1 capitalize">
              {currentGroup.group_type} • {stats.memberCount} members
            </p>
          )}
          {!isGroupMode && (
            <p className="text-gray-600 mt-1">
              Your personal financial overview
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {!isGroupMode && (
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showPredictions
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>AI Predictions</span>
            </button>
          )}
          <div className="text-sm text-gray-500">
            Welcome back, {user?.email}
          </div>
        </div>
      </div>

      {/* Mode Indicator */}
      <div className={`p-4 rounded-lg border-l-4 ${
        isGroupMode 
          ? 'bg-blue-50 border-blue-400 text-blue-800' 
          : 'bg-green-50 border-green-400 text-green-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-lg">
              {isGroupMode && currentGroup 
                ? `📊 ${currentGroup.name} Group Dashboard`
                : '👤 Personal Financial Dashboard'
              }
            </p>
            <p className="text-sm opacity-90 mt-1">
              {isGroupMode && currentGroup 
                ? `Viewing shared financial data for your ${currentGroup.group_type} group`
                : 'Viewing your personal expenses, investments, and splitwise data'
              }
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              {isGroupMode ? 'Group Mode' : 'Personal Mode'}
            </p>
            <p className="text-xs opacity-75">
              {isGroupMode ? 'Shared with group members' : 'Private to you only'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="card animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {isGroupMode ? 'Group total' : 'Personal total'}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Predictions Section - Only for personal mode */}
      {!isGroupMode && showPredictions && (
        <div className="card">
          <ExpensePredictions />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isGroupMode ? 'Group' : 'Personal'} Expense Trend
          </h3>
          <ExpenseChart />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isGroupMode ? 'Group' : 'Personal'} Expenses by Category
          </h3>
          <CategoryChart />
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Recent {isGroupMode ? 'Group ' : 'Personal '}Expenses
          </h3>
          <a href="/expenses" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
            View all
          </a>
        </div>
        
        {recentExpenses.length > 0 ? (
          <div className="space-y-4">
            {recentExpenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{expense.title}</h4>
                  <p className="text-sm text-gray-600">{expense.category}</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                    {isGroupMode && expense.creator_name && (
                      <>
                        <span>•</span>
                        <span>by {expense.creator_name}</span>
                      </>
                    )}
                    <span>•</span>
                    <span className={isGroupMode ? 'text-blue-600' : 'text-green-600'}>
                      {isGroupMode ? 'Group' : 'Personal'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${expense.amount.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No {isGroupMode ? 'group' : 'personal'} expenses yet</p>
            <a href="/expenses" className="text-primary-600 hover:text-primary-700 font-medium text-sm mt-2 inline-block">
              Add your first {isGroupMode ? 'group' : 'personal'} expense
            </a>
          </div>
        )}
      </div>

      {/* Data Separation Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">📊 Data Separation</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span><strong>Personal:</strong> Your private expenses & investments</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span><strong>Groups:</strong> Shared with group members only</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span><strong>Splitwise:</strong> Bill splitting with friends</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard