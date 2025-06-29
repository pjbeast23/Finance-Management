import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGroup } from '../contexts/GroupContext'
import { supabase } from '../lib/supabase'
import { GroupExpenseService } from '../lib/groupServices'
import { Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import Modal from '../components/UI/Modal'
import ExpenseForm from '../components/Forms/ExpenseForm'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import toast from 'react-hot-toast'

const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Education',
  'Other'
]

const Expenses = () => {
  const { user } = useAuth()
  const { isGroupMode, currentGroup } = useGroup()
  const [expenses, setExpenses] = useState<any[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  const groupExpenseService = new GroupExpenseService()

  useEffect(() => {
    if (user) {
      fetchExpenses()
    }
  }, [user, isGroupMode, currentGroup])

  useEffect(() => {
    filterExpenses()
  }, [expenses, searchTerm, selectedCategory])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      
      if (isGroupMode && currentGroup) {
        // Fetch GROUP expenses only
        const groupExpenses = await groupExpenseService.getGroupExpenses(currentGroup.id)
        setExpenses(groupExpenses)
      } else {
        // Fetch PERSONAL expenses only
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user!.id)
          .order('date', { ascending: false })

        if (error) throw error
        setExpenses(data || [])
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast.error('Error fetching expenses')
    } finally {
      setLoading(false)
    }
  }

  const filterExpenses = () => {
    let filtered = expenses

    if (searchTerm) {
      filtered = filtered.filter(expense =>
        expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(expense => expense.category === selectedCategory)
    }

    setFilteredExpenses(filtered)
  }

  const handleAddExpense = () => {
    if (isGroupMode && !currentGroup) {
      toast.error('Please select a group first')
      return
    }
    setEditingExpense(null)
    setIsModalOpen(true)
  }

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense)
    setIsModalOpen(true)
  }

  const handleDeleteExpense = async (expense: any) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      if (isGroupMode && currentGroup) {
        // Delete GROUP expense
        await groupExpenseService.deleteGroupExpense(expense.id)
      } else {
        // Delete PERSONAL expense
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expense.id)

        if (error) throw error
      }
      
      toast.success('Expense deleted successfully')
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Error deleting expense')
    }
  }

  const handleExpenseSubmit = () => {
    setIsModalOpen(false)
    fetchExpenses()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isGroupMode && currentGroup ? `${currentGroup.name} Expenses` : 'Personal Expenses'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isGroupMode && currentGroup 
              ? `Group expenses shared with ${currentGroup.member_count} members`
              : 'Your personal expense tracking'
            }
          </p>
        </div>
        <button
          onClick={handleAddExpense}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add {isGroupMode ? 'Group' : 'Personal'} Expense</span>
        </button>
      </div>

      {/* Mode Indicator */}
      <div className={`p-3 rounded-lg border-l-4 ${
        isGroupMode 
          ? 'bg-blue-50 border-blue-400 text-blue-800' 
          : 'bg-green-50 border-green-400 text-green-800'
      }`}>
        <p className="font-medium">
          {isGroupMode && currentGroup 
            ? `📊 Viewing group expenses for "${currentGroup.name}"`
            : '👤 Viewing your personal expenses'
          }
        </p>
      </div>

      {/* Summary Card */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-600">
              Total {isGroupMode ? 'Group' : 'Personal'} Expenses
            </p>
            <p className="text-3xl font-bold text-gray-900">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{filteredExpenses.length} transactions</p>
            <p className="text-xs text-gray-500">
              {isGroupMode ? 'Shared expenses' : 'Personal expenses only'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="card">
        {filteredExpenses.length > 0 ? (
          <div className="space-y-4">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{expense.title}</h3>
                  <p className="text-sm text-gray-600">{expense.category}</p>
                  {expense.description && (
                    <p className="text-sm text-gray-500 mt-1">{expense.description}</p>
                  )}
                  <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                    <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                    {isGroupMode && expense.creator_name && (
                      <>
                        <span>•</span>
                        <span>Added by {expense.creator_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${expense.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {isGroupMode ? 'Group expense' : 'Personal'}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditExpense(expense)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors duration-200"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(expense)}
                      className="p-2 text-gray-400 hover:text-error-600 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {isGroupMode ? 'group' : 'personal'} expenses found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || selectedCategory 
                ? 'Try adjusting your filters' 
                : `Get started by adding your first ${isGroupMode ? 'group' : 'personal'} expense`
              }
            </p>
            <button
              onClick={handleAddExpense}
              className="btn-primary"
            >
              Add {isGroupMode ? 'Group' : 'Personal'} Expense
            </button>
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense 
          ? `Edit ${isGroupMode ? 'Group' : 'Personal'} Expense` 
          : `Add New ${isGroupMode ? 'Group' : 'Personal'} Expense`
        }
      >
        <ExpenseForm
          expense={editingExpense}
          onSubmit={handleExpenseSubmit}
          onCancel={() => setIsModalOpen(false)}
          isGroupMode={isGroupMode}
          currentGroup={currentGroup}
        />
      </Modal>
    </div>
  )
}

export default Expenses