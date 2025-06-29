import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ExpensePredictor, ExpensePrediction, TrendAnalysis } from '../../lib/predictions'
import { TrendingUp, TrendingDown, Target, Brain, AlertTriangle } from 'lucide-react'
import LoadingSpinner from '../UI/LoadingSpinner'

const ExpensePredictions = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState<{
    monthly: ExpensePrediction | null
    categories: ExpensePrediction[]
    trends: TrendAnalysis | null
  }>({
    monthly: null,
    categories: [],
    trends: null
  })

  useEffect(() => {
    if (user) {
      generatePredictions()
    }
  }, [user])

  const generatePredictions = async () => {
    try {
      const predictor = new ExpensePredictor(user!.id)
      const results = await predictor.generateAllPredictions()
      setPredictions(results)
    } catch (error) {
      console.error('Error generating predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-success-600 bg-success-50'
    if (confidence >= 0.6) return 'text-warning-600 bg-warning-50'
    return 'text-error-600 bg-error-50'
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-5 w-5 text-error-600" />
      case 'decreasing':
        return <TrendingDown className="h-5 w-5 text-success-600" />
      default:
        return <Target className="h-5 w-5 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Brain className="h-6 w-6 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">AI Expense Predictions</h2>
      </div>

      {/* Monthly Prediction */}
      {predictions.monthly && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Monthly Forecast</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(predictions.monthly.confidence)}`}>
              {Math.round(predictions.monthly.confidence * 100)}% confidence
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900">
                ${predictions.monthly.predictedAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Predicted monthly total</p>
            </div>
            <Target className="h-12 w-12 text-primary-600" />
          </div>
        </div>
      )}

      {/* Spending Trends */}
      {predictions.trends && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Spending Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              {getTrendIcon(predictions.trends.trend)}
              <div>
                <p className="font-medium text-gray-900 capitalize">{predictions.trends.trend}</p>
                <p className="text-sm text-gray-600">
                  {Math.abs(predictions.trends.changePercent).toFixed(1)}% vs last month
                </p>
              </div>
            </div>
            <div>
              <p className="font-medium text-gray-900">${predictions.trends.averageDaily.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Daily average</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">${predictions.trends.averageWeekly.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Weekly average</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Predictions */}
      {predictions.categories.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Category Forecasts</h3>
          <div className="space-y-3">
            {predictions.categories.slice(0, 5).map((prediction, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{prediction.category}</p>
                  <p className="text-sm text-gray-600">
                    ${prediction.predictedAmount.toFixed(2)} predicted
                  </p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(prediction.confidence)}`}>
                  {Math.round(prediction.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights and Recommendations */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Smart Insights</h3>
        <div className="space-y-3">
          {predictions.trends?.trend === 'increasing' && (
            <div className="flex items-start space-x-3 p-3 bg-warning-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-warning-600 mt-0.5" />
              <div>
                <p className="font-medium text-warning-800">Spending is increasing</p>
                <p className="text-sm text-warning-700">
                  Your expenses have increased by {Math.abs(predictions.trends.changePercent).toFixed(1)}% 
                  compared to last month. Consider reviewing your budget.
                </p>
              </div>
            </div>
          )}
          
          {predictions.trends?.trend === 'decreasing' && (
            <div className="flex items-start space-x-3 p-3 bg-success-50 rounded-lg">
              <TrendingDown className="h-5 w-5 text-success-600 mt-0.5" />
              <div>
                <p className="font-medium text-success-800">Great job saving!</p>
                <p className="text-sm text-success-700">
                  Your expenses have decreased by {Math.abs(predictions.trends.changePercent).toFixed(1)}% 
                  compared to last month. Keep up the good work!
                </p>
              </div>
            </div>
          )}

          {predictions.monthly && predictions.monthly.confidence < 0.6 && (
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <Brain className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Need more data</p>
                <p className="text-sm text-gray-700">
                  Add more expenses to improve prediction accuracy. The AI learns from your spending patterns.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={generatePredictions}
        className="btn-secondary w-full"
        disabled={loading}
      >
        {loading ? <LoadingSpinner size="sm" /> : 'Refresh Predictions'}
      </button>
    </div>
  )
}

export default ExpensePredictions