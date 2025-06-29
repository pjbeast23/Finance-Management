import React, { useState, useEffect } from 'react'
import { Investment } from '../../lib/investments'
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

interface InvestmentChartProps {
  investments: Investment[]
}

const InvestmentChart: React.FC<InvestmentChartProps> = ({ investments }) => {
  const [chartData, setChartData] = useState<any>(null)

  useEffect(() => {
    generateChartData()
  }, [investments])

  const generateChartData = () => {
    if (investments.length === 0) {
      setChartData(null)
      return
    }

    // Generate last 30 days
    const days = []
    const portfolioValues = []
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i)
      days.push(format(date, 'MMM dd'))
      
      // Simulate portfolio value over time with some random variation
      let totalValue = 0
      investments.forEach(investment => {
        const currentValue = investment.quantity * investment.current_price
        // Add some random variation to simulate price changes over time
        const variation = 1 + (Math.random() - 0.5) * 0.1 // ±5% variation
        totalValue += currentValue * variation
      })
      
      portfolioValues.push(totalValue)
    }

    setChartData({
      labels: days,
      datasets: [
        {
          label: 'Portfolio Value',
          data: portfolioValues,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    })
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
            return `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value: any) {
            return '$' + value.toLocaleString()
          }
        }
      }
    }
  }

  if (!chartData) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No investment data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  )
}

export default InvestmentChart