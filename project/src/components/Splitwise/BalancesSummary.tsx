import { useState, useEffect } from 'react'
import { SplitwiseService, UserBalance } from '../../lib/splitwise'
import { DollarSign, TrendingUp, TrendingDown, Users } from 'lucide-react'
import LoadingSpinner from '../UI/LoadingSpinner'
import toast from 'react-hot-toast'

const BalancesSummary = () => {
  const [balances, setBalances] = useState<UserBalance[]>([])
  const [loading, setLoading] = useState(true)

  const splitwiseService = new SplitwiseService()

  useEffect(() => {
    fetchBalances()
  }, [])

  const fetchBalances = async () => {
    try {
      const userBalances = await splitwiseService.getUserBalances()
      setBalances(userBalances)
    } catch (error) {
      console.error('Error fetching balances:', error)
      toast.error('Error loading balances')
    } finally {
      setLoading(false)
    }
  }

  const totalOwedToYou = balances
    .filter(b => b.balance > 0)
    .reduce((sum, b) => sum + b.balance, 0)

  const totalYouOwe = balances
    .filter(b => b.balance < 0)
    .reduce((sum, b) => sum + Math.abs(b.balance), 0)

  const netBalance = totalOwedToYou - totalYouOwe

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">You are owed</p>
              <p className="text-2xl font-bold text-success-600">${totalOwedToYou.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-success-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">You owe</p>
              <p className="text-2xl font-bold text-error-600">${totalYouOwe.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-error-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Net balance</p>
              <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                ${Math.abs(netBalance).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                {netBalance >= 0 ? 'in your favor' : 'you owe'}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-primary-600" />
          </div>
        </div>
      </div>

      {/* Individual Balances */}
      {balances.length > 0 ? (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Individual Balances</h3>
          <div className="space-y-3">
            {balances.map((balance, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-100 rounded-full">
                    <Users className="h-4 w-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{balance.friend_name}</p>
                    <p className="text-sm text-gray-600">{balance.friend_email}</p>
                  </div>
                </div>
                <div className="text-right">
                  {balance.balance > 0 ? (
                    <div>
                      <p className="font-semibold text-success-600">+${balance.balance.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">owes you</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-error-600">-${Math.abs(balance.balance).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">you owe</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No balances yet</h3>
          <p className="text-gray-500">
            Start sharing expenses with friends to see your balances here
          </p>
        </div>
      )}
    </div>
  )
}

export default BalancesSummary