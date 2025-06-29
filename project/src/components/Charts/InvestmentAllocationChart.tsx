import React, { useState, useEffect } from 'react'
import { Investment } from '../../lib/investments'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

interface InvestmentAllocationChartProps {
  investments: Investment[]
}

const InvestmentAllocationChart: React.FC<InvestmentAllocationChartProps> = ({ investments }) => {
  const [chartData, setChartData] = useState<any>(null)

  useEffect(() => {
    generateChartData()
  }, [investments])

  const generateChartData = () => {
    if (investments.length === 0) {
      setChartData(null)
      return
    }

    // Group by investment type
    const allocationByType: { [key: string]: number } = {}
    let totalValue = 0

    investments.forEach(investment => {
      const currentValue = investment.quantity * investment.current_price
      allocationByType[investment.investment_type] = (allocationByType[investment.investment_type] || 0) + currentValue
      totalValue += currentValue
    })

    const types = Object.keys(allocationByType)
    const values = Object.values(allocationByType)

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
      labels: types.map(type => type.replace('_', ' ').toUpperCase()),
      datasets: [
        {
          data: values,
          backgroundColor: colors.slice(0, types.length),
          borderColor: '#fff',
          borderWidth: 2
        }
      ]
    })
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
            return `${context.label}: $${context.parsed.toLocaleString()} (${percentage}%)`
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
      <Doughnut data={chartData} options={options} />
    </div>
  )
}

export default InvestmentAllocationChart