import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGroup } from '../../contexts/GroupContext'
import { supabase } from '../../lib/supabase'
import { GroupExpenseService } from '../../lib/groupServices'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const CategoryChart = () => {
  const { user } = useAuth()
  const { isGroupMode, currentGroup } = useGroup()
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const groupExpenseService = new GroupExpenseService()

  useEffect(() => {
    if (user) {
      fetchChartData()
    }
  }, [user, isGroupMode, currentGroup])

  const fetchChartData = async () => {
    try {
      let data: any[] = []

      if (isGroupMode && currentGroup) {
        // Fetch GROUP expenses only
        const groupExpenses = await groupExpenseService.getGroupExpenses(currentGroup.id)
        data = groupExpenses
      } else {
        // Fetch PERSONAL expenses only
        const { data: personalExpenses, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user!.id)

        if (error) throw error
        data = personalExpenses || []
      }

      // Group by category
      const categoryTotals: { [key: string]: number } = {}
      data.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount
      })

      const categories = Object.keys(categoryTotals)
      const amounts = Object.values(categoryTotals)

      const colors = [
        '#3B82F6', // Blue
        '#10B981', // Green
        '#F59E0B', // Orange
        '#EF4444', // Red
        '#8B5CF6', // Purple
        '#F97316', // Orange
        '#06B6D4', // Cyan
        '#84CC16', // Lime
        '#EC4899'  // Pink
      ]

      setChartData({
        labels: categories,
        datasets: [
          {
            data: amounts,
            backgroundColor: colors.slice(0, categories.length),
            borderColor: '#fff',
            borderWidth: 2
          }
        ]
      })
    } catch (error) {
      console.error('Error fetching category data:', error)
    } finally {
      setLoading(false)
    }
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context: any) {
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = ((context.parsed * 100) / total).toFixed(1)
            return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`
          }
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded-full h-48 w-48"></div>
      </div>
    )
  }

  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No {isGroupMode ? 'group' : 'personal'} expense data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <Doughnut data={chartData} options={options} />
    </div>
  )
}

export default CategoryChart