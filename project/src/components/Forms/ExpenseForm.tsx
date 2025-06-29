import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { GroupExpenseService } from '../../lib/groupServices'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

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

const expenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required')
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseFormProps {
  expense?: any
  onSubmit: () => void
  onCancel: () => void
  isGroupMode?: boolean
  currentGroup?: any
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ 
  expense, 
  onSubmit, 
  onCancel, 
  isGroupMode = false, 
  currentGroup 
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const groupExpenseService = new GroupExpenseService()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: expense?.title || '',
      amount: expense?.amount || 0,
      category: expense?.category || '',
      description: expense?.description || '',
      date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]
    }
  })

  const handleFormSubmit = async (data: ExpenseFormData) => {
    setLoading(true)
    try {
      const expenseData = {
        ...data,
        date: new Date(data.date).toISOString()
      }

      if (isGroupMode && currentGroup) {
        // Handle GROUP expense
        if (expense) {
          await groupExpenseService.updateGroupExpense(expense.id, expenseData)
          toast.success('Group expense updated successfully')
        } else {
          await groupExpenseService.createGroupExpense(currentGroup.id, expenseData)
          toast.success('Group expense added successfully')
        }
      } else {
        // Handle PERSONAL expense
        const personalExpenseData = {
          ...expenseData,
          user_id: user!.id
        }

        if (expense) {
          const { error } = await supabase
            .from('expenses')
            .update(personalExpenseData)
            .eq('id', expense.id)

          if (error) throw error
          toast.success('Personal expense updated successfully')
        } else {
          const { error } = await supabase
            .from('expenses')
            .insert([personalExpenseData])

          if (error) throw error
          toast.success('Personal expense added successfully')
        }
      }

      onSubmit()
    } catch (error: any) {
      console.error('Error saving expense:', error)
      toast.error(error.message || 'Error saving expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Mode Indicator */}
      <div className={`mb-4 p-3 rounded-lg border-l-4 ${
        isGroupMode 
          ? 'bg-blue-50 border-blue-400 text-blue-800' 
          : 'bg-green-50 border-green-400 text-green-800'
      }`}>
        <p className="text-sm font-medium">
          {isGroupMode && currentGroup 
            ? `📊 Adding expense to group: "${currentGroup.name}"`
            : '👤 Adding to your personal expenses'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            {...register('title')}
            type="text"
            className="input-field"
            placeholder="Enter expense title"
          />
          {errors.title && (
            <p className="text-error-600 text-sm mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount *
          </label>
          <input
            {...register('amount', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            className="input-field"
            placeholder="0.00"
          />
          {errors.amount && (
            <p className="text-error-600 text-sm mt-1">{errors.amount.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select {...register('category')} className="input-field">
            <option value="">Select a category</option>
            {CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          {errors.category && (
            <p className="text-error-600 text-sm mt-1">{errors.category.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date *
          </label>
          <input
            {...register('date')}
            type="date"
            className="input-field"
          />
          {errors.date && (
            <p className="text-error-600 text-sm mt-1">{errors.date.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="input-field"
            placeholder="Add a description (optional)"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center space-x-2"
            disabled={loading}
          >
            {loading && <LoadingSpinner size="sm" />}
            <span>
              {expense ? 'Update' : 'Add'} {isGroupMode ? 'Group' : 'Personal'} Expense
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default ExpenseForm