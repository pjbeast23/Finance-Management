import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { InvestmentService, Investment, InvestmentSummary, PriceUpdateResult } from '../lib/investments'
import { GroupInvestmentService } from '../lib/groupServices'
import { TrendingUp, TrendingDown, DollarSign, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import Modal from '../components/UI/Modal'
import InvestmentForm from '../components/Forms/InvestmentForm'
import InvestmentChart from '../components/Charts/InvestmentChart'
import InvestmentAllocationChart from '../components/Charts/InvestmentAllocationChart'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const Investments = () => {
  const { user } = useAuth()
  const { isGroupMode, currentGroup } = useGroup()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [summary, setSummary] = useState<InvestmentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [updatingPrices, setUpdatingPrices] = useState(false)
  const [priceUpdateResults, setPriceUpdateResults] = useState<PriceUpdateResult[]>([])

  const investmentService = new InvestmentService()
  const groupInvestmentService = new GroupInvestmentService()

  useEffect(() => {
    if (user) {
      fetchInvestments()
    }
  }, [user, isGroupMode, currentGroup])

  const fetchInvestments = async () => {
    try {
      setLoading(true)
      
      if (isGroupMode && currentGroup) {
        // Fetch GROUP investments only
        const groupInvestments = await groupInvestmentService.getGroupInvestments(currentGroup.id)
        // Map GroupInvestment to Investment by adding missing user_id field
        const mappedInvestments = groupInvestments.map(inv => ({
          ...inv,
          user_id: inv.created_by // Use created_by as user_id for group investments
        })) as Investment[]
        setInvestments(mappedInvestments)
        
        // Calculate group investment summary
        const groupSummary = calculateGroupSummary(groupInvestments)
        setSummary(groupSummary)
      } else {
        // Fetch PERSONAL investments only
        const [investmentsData, summaryData] = await Promise.all([
          investmentService.getInvestments(),
          investmentService.getInvestmentSummary()
        ])
        
        setInvestments(investmentsData)
        setSummary(summaryData)
      }
    } catch (error) {
      console.error('Error fetching investments:', error)
      toast.error('Error loading investments')
    } finally {
      setLoading(false)
    }
  }

  const calculateGroupSummary = (groupInvestments: any[]): InvestmentSummary => {
    let totalValue = 0
    let totalInvested = 0
    let topPerformer: Investment | null = null
    let worstPerformer: Investment | null = null
    let maxGainPercent = -Infinity
    let minGainPercent = Infinity

    groupInvestments.forEach(investment => {
      const currentValue = investment.quantity * investment.current_price
      const investedValue = investment.quantity * investment.purchase_price
      const gainLoss = currentValue - investedValue
      const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0

      totalValue += currentValue
      totalInvested += investedValue

      if (gainLossPercent > maxGainPercent) {
        maxGainPercent = gainLossPercent
        topPerformer = investment as Investment
      }

      if (gainLossPercent < minGainPercent) {
        minGainPercent = gainLossPercent
        worstPerformer = investment as Investment
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

  const handleAddInvestment = () => {
    if (isGroupMode && !currentGroup) {
      toast.error('Please select a group first')
      return
    }
    setEditingInvestment(null)
    setIsModalOpen(true)
  }

  const handleEditInvestment = (investment: Investment) => {
    setEditingInvestment(investment)
    setIsModalOpen(true)
  }

  const handleDeleteInvestment = async (investment: Investment) => {
    if (!confirm('Are you sure you want to delete this investment?')) return

    try {
      if (isGroupMode && currentGroup) {
        // Delete GROUP investment
        await groupInvestmentService.deleteGroupInvestment(investment.id)
      } else {
        // Delete PERSONAL investment
        await investmentService.deleteInvestment(investment.id)
      }
      
      toast.success('Investment deleted successfully')
      fetchInvestments()
    } catch (error: any) {
      console.error('Error deleting investment:', error)
      toast.error(error.message || 'Error deleting investment')
    }
  }

  const handleInvestmentSubmit = () => {
    setIsModalOpen(false)
    setEditingInvestment(null)
    fetchInvestments()
  }

  const handleUpdatePrices = async () => {
    if (investments.length === 0) {
      toast.error('No investments to update')
      return
    }

    setUpdatingPrices(true)
    setPriceUpdateResults([])
    
    try {
      if (isGroupMode && currentGroup) {
        // Update GROUP investment prices
        await groupInvestmentService.updateGroupInvestmentPrices(currentGroup.id)
        toast.success('Group investment prices updated successfully')
      } else {
        // Update PERSONAL investment prices
        const results = await investmentService.updatePricesFromAlphaVantage()
        setPriceUpdateResults(results)
        
        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length
        
        if (successCount > 0) {
          toast.success(`Updated ${successCount} prices successfully${failCount > 0 ? `, ${failCount} failed` : ''}`)
        } else {
          toast.error('Failed to update any prices')
        }
      }
      
      fetchInvestments()
    } catch (error: any) {
      console.error('Error updating prices:', error)
      toast.error(error.message || 'Error updating prices')
    } finally {
      setUpdatingPrices(false)
    }
  }

  const calculateGainLoss = (investment: Investment) => {
    const currentValue = investment.quantity * investment.current_price
    const investedValue = investment.quantity * investment.purchase_price
    const gainLoss = currentValue - investedValue
    const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0
    
    return { gainLoss, gainLossPercent, currentValue, investedValue }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isGroupMode && currentGroup ? `${currentGroup.name} Investments` : 'Personal Investments'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isGroupMode && currentGroup 
              ? `Group investment portfolio shared with ${currentGroup.member_count} members`
              : 'Your personal investment portfolio'
            }
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleUpdatePrices}
            disabled={updatingPrices || investments.length === 0}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${updatingPrices ? 'animate-spin' : ''}`} />
            <span>Update Prices</span>
          </button>
          <button
            onClick={handleAddInvestment}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add {isGroupMode ? 'Group' : 'Personal'} Investment</span>
          </button>
        </div>
      </div>

      {/* Mode Indicator */}
      <div className={`p-3 rounded-lg border-l-4 ${
        isGroupMode 
          ? 'bg-blue-50 border-blue-400 text-blue-800' 
          : 'bg-green-50 border-green-400 text-green-800'
      }`}>
        <p className="font-medium">
          {isGroupMode && currentGroup 
            ? `📈 Viewing group investments for "${currentGroup.name}"`
            : '👤 Viewing your personal investment portfolio'
          }
        </p>
      </div>

      {/* Price Update Results */}
      {priceUpdateResults.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Update Results</h3>
          <div className="space-y-2">
            {priceUpdateResults.map((result, index) => (
              <div key={index} className={`flex justify-between items-center p-2 rounded ${
                result.success ? 'bg-success-50' : 'bg-error-50'
              }`}>
                <span className="font-medium">{result.symbol}</span>
                {result.success ? (
                  <div className="text-right">
                    <div className="text-sm">
                      ${result.oldPrice.toFixed(2)} → ${result.newPrice.toFixed(2)}
                    </div>
                    <div className={`text-xs ${result.change >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                      {result.change >= 0 ? '+' : ''}${result.change.toFixed(2)} ({result.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                ) : (
                  <span className="text-error-600 text-sm">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
                <p className="text-2xl font-bold text-gray-900">${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500">
                  {isGroupMode ? 'Group total' : 'Personal total'}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-primary-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900">${summary.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${summary.totalGainLoss >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                  {summary.totalGainLoss >= 0 ? '+' : ''}${summary.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className={`text-sm ${summary.totalGainLoss >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                  {summary.totalGainLoss >= 0 ? '+' : ''}{summary.totalGainLossPercent.toFixed(2)}%
                </p>
              </div>
              {summary.totalGainLoss >= 0 ? (
                <TrendingUp className="h-8 w-8 text-success-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-error-600" />
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Investments</p>
                <p className="text-2xl font-bold text-gray-900">{investments.length}</p>
                <p className="text-xs text-gray-500">
                  {isGroupMode ? 'Group holdings' : 'Personal holdings'}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-warning-600" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {investments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
            <InvestmentChart investments={investments} />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Allocation</h3>
            <InvestmentAllocationChart investments={investments} />
          </div>
        </div>
      )}

      {/* Investments List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          Your {isGroupMode ? 'Group' : 'Personal'} Investments
        </h2>
        
        {investments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchase Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gain/Loss
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {investments.map((investment) => {
                  const { gainLoss, gainLossPercent, currentValue } = calculateGainLoss(investment)
                  
                  return (
                    <tr key={investment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{investment.symbol}</div>
                          <div className="text-sm text-gray-500">{investment.name}</div>
                          <div className="text-xs text-gray-400 capitalize">{investment.investment_type.replace('_', ' ')}</div>
                          {isGroupMode && (investment as any).creator_name && (
                            <div className="text-xs text-blue-600">Added by {(investment as any).creator_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {investment.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${investment.purchase_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${investment.current_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${gainLoss >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                          {gainLoss >= 0 ? '+' : ''}${gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className={`text-xs ${gainLoss >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                          {gainLoss >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditInvestment(investment)}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvestment(investment)}
                            className="text-error-600 hover:text-error-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {isGroupMode ? 'group' : 'personal'} investments yet
            </h3>
            <p className="text-gray-500 mb-4">
              Start building your {isGroupMode ? 'group' : 'personal'} investment portfolio by adding your first investment
            </p>
            <button
              onClick={handleAddInvestment}
              className="btn-primary"
            >
              Add Your First {isGroupMode ? 'Group' : 'Personal'} Investment
            </button>
          </div>
        )}
      </div>

      {/* Investment Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingInvestment(null)
        }}
        title={editingInvestment 
          ? `Edit ${isGroupMode ? 'Group' : 'Personal'} Investment` 
          : `Add New ${isGroupMode ? 'Group' : 'Personal'} Investment`
        }
      >
        <InvestmentForm
          investment={editingInvestment || undefined}
          onSubmit={handleInvestmentSubmit}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingInvestment(null)
          }}
          isGroupMode={isGroupMode}
          currentGroup={currentGroup}
        />
      </Modal>
    </div>
  )
}

export default Investments