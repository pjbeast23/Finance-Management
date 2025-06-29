import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { SplitwiseService, SharedExpense } from '../lib/splitwise'
import { Users, Plus, Receipt, DollarSign, Edit2, Trash2, CheckCircle, AlertTriangle, Filter } from 'lucide-react'
import { format } from 'date-fns'
import Modal from '../components/UI/Modal'
import FriendsList from '../components/Splitwise/FriendsList'
import SharedExpenseForm from '../components/Splitwise/SharedExpenseForm'
import BalancesSummary from '../components/Splitwise/BalancesSummary'
import SettleUpModal from '../components/Splitwise/SettleUpModal'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const Splitwise = () => {
  const { user } = useAuth()
  const { groups } = useGroup()
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<SharedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<SharedExpense | null>(null)
  const [activeTab, setActiveTab] = useState<'expenses' | 'friends' | 'balances'>('expenses')
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('')
  const [settleUpData, setSettleUpData] = useState<{
    participantId: string
    participantName: string
    participantEmail: string
    amountOwed: number
    expenseTitle: string
  } | null>(null)

  const splitwiseService = new SplitwiseService()

  useEffect(() => {
    if (user) {
      fetchSharedExpenses()
    }
  }, [user])

  useEffect(() => {
    filterExpenses()
  }, [sharedExpenses, selectedGroupFilter])

  const fetchSharedExpenses = async () => {
    try {
      const expenses = await splitwiseService.getSharedExpenses()
      setSharedExpenses(expenses)
    } catch (error) {
      console.error('Error fetching shared expenses:', error)
      toast.error('Error loading shared expenses')
    } finally {
      setLoading(false)
    }
  }

  const filterExpenses = () => {
    let filtered = sharedExpenses

    if (selectedGroupFilter) {
      filtered = filtered.filter(expense => 
        (expense as any).group_id === selectedGroupFilter
      )
    }

    setFilteredExpenses(filtered)
  }

  const handleAddExpense = () => {
    setEditingExpense(null)
    setIsModalOpen(true)
  }

  const handleEditExpense = (expense: SharedExpense) => {
    setEditingExpense(expense)
    setIsModalOpen(true)
  }

  const handleDeleteExpense = async (expense: SharedExpense) => {
    if (!confirm('Are you sure you want to delete this shared expense?')) return

    try {
      await splitwiseService.deleteSharedExpense(expense.id)
      toast.success('Shared expense deleted successfully')
      fetchSharedExpenses()
    } catch (error: any) {
      console.error('Error deleting shared expense:', error)
      toast.error(error.message || 'Error deleting shared expense')
    }
  }

  const handleExpenseSubmit = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    fetchSharedExpenses()
  }

  const handleSettleUp = (participant: any, expense: SharedExpense) => {
    setSettleUpData({
      participantId: participant.id,
      participantName: participant.user_name,
      participantEmail: participant.user_email,
      amountOwed: participant.amount_owed,
      expenseTitle: expense.title
    })
  }

  const handleSettleUpComplete = () => {
    setSettleUpData(null)
    fetchSharedExpenses()
  }

  const getGroupName = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    return group ? group.name : 'Unknown Group'
  }

  const renderExpenseParticipants = (expense: SharedExpense) => {
    return (
      <div className="mt-3 space-y-2">
        {expense.participants.map((participant, index) => (
          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div className="flex-1">
              <span className="text-sm text-gray-700">{participant.user_name}</span>
              <span className={`ml-2 text-sm font-medium ${participant.is_settled ? 'text-success-600' : 'text-gray-900'}`}>
                ${participant.amount_owed.toFixed(2)}
                {participant.is_settled && ' ✓'}
              </span>
            </div>
            {!participant.is_settled && participant.user_email !== user?.email && expense.created_by === user?.id && (
              <button
                onClick={() => handleSettleUp(participant, expense)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-success-100 text-success-700 rounded hover:bg-success-200 transition-colors"
              >
                <CheckCircle className="h-3 w-3" />
                <span>Settle Up</span>
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const totalSharedAmount = filteredExpenses.reduce((sum, expense) => sum + expense.total_amount, 0)
  const settledExpenses = filteredExpenses.filter(expense => expense.is_settled).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Splitwise</h1>
          <p className="text-gray-600 mt-1">
            Split bills and expenses with friends - completely separate from groups
          </p>
        </div>
        <button
          onClick={handleAddExpense}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Shared Expense</span>
        </button>
      </div>

      {/* Splitwise Explanation */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-800">About Splitwise</h4>
            <p className="text-sm text-purple-700 mt-1">
              Splitwise is for splitting bills with friends and tracking who owes what. This is completely separate from your personal expenses and group expenses. Use this when you want to split restaurant bills, shared purchases, or any expense with friends.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shared</p>
              <p className="text-2xl font-bold text-gray-900">${totalSharedAmount.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Splitwise only</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Shared Expenses</p>
              <p className="text-2xl font-bold text-gray-900">{filteredExpenses.length}</p>
              <p className="text-xs text-gray-500">Bills split with friends</p>
            </div>
            <Receipt className="h-8 w-8 text-success-600" />
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Settled</p>
              <p className="text-2xl font-bold text-gray-900">{settledExpenses}</p>
              <p className="text-xs text-gray-500">Fully paid expenses</p>
            </div>
            <Users className="h-8 w-8 text-warning-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'expenses', label: 'Shared Expenses', icon: Receipt },
            { id: 'balances', label: 'Balances', icon: DollarSign },
            { id: 'friends', label: 'Friends', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            {/* Group Filter */}
            <div className="card">
              <div className="flex items-center space-x-4">
                <Filter className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Group
                  </label>
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="input-field"
                  >
                    <option value="">All Expenses (Friends + Groups)</option>
                    <option value="friends-only">Friends Only (No Group)</option>
                    {groups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name} Group
                      </option>
                    ))}
                  </select>
                </div>
                {selectedGroupFilter && (
                  <button
                    onClick={() => setSelectedGroupFilter('')}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Shared Expenses
                {selectedGroupFilter && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({filteredExpenses.length} filtered)
                  </span>
                )}
              </h2>
              
              {filteredExpenses.length > 0 ? (
                <div className="space-y-4">
                  {filteredExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{expense.title}</h3>
                          {expense.description && (
                            <p className="text-sm text-gray-600">{expense.description}</p>
                          )}
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>{expense.category}</span>
                            <span>•</span>
                            <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                            {(expense as any).group_id && (
                              <>
                                <span>•</span>
                                <span className="text-blue-600 font-medium">
                                  {getGroupName((expense as any).group_id)} Group
                                </span>
                              </>
                            )}
                          </div>
                          <span className="inline-block px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full mt-1">
                            Splitwise
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">${expense.total_amount.toFixed(2)}</p>
                            <p className="text-sm text-gray-500 capitalize">{expense.split_method} split</p>
                            {expense.is_settled && (
                              <span className="inline-block px-2 py-1 text-xs font-medium text-success-700 bg-success-100 rounded-full mt-1">
                                Settled
                              </span>
                            )}
                          </div>
                          {expense.created_by === user?.id && (
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEditExpense(expense)}
                                className="p-2 text-gray-400 hover:text-primary-600 transition-colors duration-200"
                                title="Edit expense"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense)}
                                className="p-2 text-gray-400 hover:text-error-600 transition-colors duration-200"
                                title="Delete expense"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {renderExpenseParticipants(expense)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedGroupFilter ? 'No expenses found for this filter' : 'No shared expenses yet'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {selectedGroupFilter 
                      ? 'Try changing your filter or create a new expense'
                      : 'Start splitting bills with friends to track who owes what'
                    }
                  </p>
                  <button
                    onClick={handleAddExpense}
                    className="btn-primary"
                  >
                    Add Your First Shared Expense
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'balances' && <BalancesSummary />}
        {activeTab === 'friends' && <FriendsList />}
      </div>

      {/* Shared Expense Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingExpense(null)
        }}
        title={editingExpense ? 'Edit Shared Expense' : 'Add Shared Expense'}
      >
        <SharedExpenseForm
          expense={editingExpense || undefined}
          onSubmit={handleExpenseSubmit}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingExpense(null)
          }}
        />
      </Modal>

      {/* Settle Up Modal */}
      {settleUpData && (
        <SettleUpModal
          participantId={settleUpData.participantId}
          participantName={settleUpData.participantName}
          participantEmail={settleUpData.participantEmail}
          amountOwed={settleUpData.amountOwed}
          expenseTitle={settleUpData.expenseTitle}
          onClose={() => setSettleUpData(null)}
          onSettled={handleSettleUpComplete}
        />
      )}
    </div>
  )
}

export default Splitwise