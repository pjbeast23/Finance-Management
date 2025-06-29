import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useGroup } from '../../contexts/GroupContext'
import { supabase } from '../../lib/supabase'
import { GroupExpenseService } from '../../lib/groupServices'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { format, subDays } from 'date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const ExpenseChart = () => {
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
      const endDate = new Date()
      const startDate = subDays(endDate, 30)

      let data: any[] = []

      if (isGroupMode && currentGroup) {
        // Fetch GROUP expenses only
        const groupExpenses = await groupExpenseService.getGroupExpenses(currentGroup.id)
        data = groupExpenses.filter(expense => 
          new Date(expense.date) >= startDate && new Date(expense.date) <= endDate
        )
      } else {
        // Fetch PERSONAL expenses only
        const { data: personalExpenses, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user!.id)
          .gte('date', startDate.toISOString())
          .lte('date', endDate.toISOString())
          .order('date', { ascending: true })

        if (error) throw error
        data = personalExpenses || []
      }

      // Group expenses by date
      const expensesByDate: { [key: string]: number } = {}
      
      // Initialize all dates with 0
      for (let i = 0; i <= 30; i++) {
        const date = format(subDays(endDate, 30 - i), 'MMM dd')
        expensesByDate[date] = 0
      }

      // Sum expenses by date
      data.forEach(expense => {
        const date = format(new Date(expense.date), 'MMM dd')
        expensesByDate[date] = (expensesByDate[date] || 0) + expense.amount
      })

      const labels = Object.keys(expensesByDate)
      const values = Object.values(expensesByDate)

      setChartData({
        labels,
        datasets: [
          {
            label: isGroupMode ? 'Group Daily Expenses' : 'Personal Daily Expenses',
            data: values,
            borderColor: isGroupMode ? 'rgb(37, 99, 235)' : 'rgb(34, 197, 94)',
            backgroundColor: isGroupMode ? 'rgba(37, 99, 235, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      })
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        callbacks: {
          label: function(context: any) {
            return `$${context.parsed.y.toFixed(2)}`
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxTicksLimit: 7
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value
          }
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse bg-gray-200 rounded h-full w-full"></div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No {isGroupMode ? 'group' : 'personal'} expense data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  )
}

export default ExpenseChart