import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../../contexts/AuthContext'
import { useGroup } from '../../contexts/GroupContext'
import { SplitwiseService, Friend, SharedExpense } from '../../lib/splitwise'
import { Minus, AlertTriangle } from 'lucide-react'
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

const sharedExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  total_amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  split_method: z.enum(['equal', 'percentage', 'custom', 'shares']),
  group_id: z.string().optional()
})

type SharedExpenseFormData = z.infer<typeof sharedExpenseSchema>

interface SharedExpenseFormProps {
  expense?: SharedExpense
  onSubmit: () => void
  onCancel: () => void
}

const SharedExpenseForm: React.FC<SharedExpenseFormProps> = ({ expense, onSubmit, onCancel }) => {
  const { user } = useAuth()
  const { groups } = useGroup()
  const [loading, setLoading] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([])
  const [splitMethod, setSplitMethod] = useState<'equal' | 'percentage' | 'custom' | 'shares'>('equal')
  const [percentages, setPercentages] = useState<{ [key: string]: number }>({})
  const [customAmounts, setCustomAmounts] = useState<{ [key: string]: number }>({})
  const [shares, setShares] = useState<{ [key: string]: number }>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groupMembers, setGroupMembers] = useState<any[]>([])

  const splitwiseService = new SplitwiseService()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<SharedExpenseFormData>({
    resolver: zodResolver(sharedExpenseSchema),
    defaultValues: {
      title: expense?.title || '',
      description: expense?.description || '',
      total_amount: expense?.total_amount || 0,
      category: expense?.category || '',
      date: expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
      split_method: expense?.split_method || 'equal',
      group_id: ''
    }
  })

  const totalAmount = watch('total_amount') || 0

  useEffect(() => {
    fetchFriends()
    
    // If editing an expense, populate the participants (excluding current user)
    if (expense && user) {
      setSplitMethod(expense.split_method)
      
      // Find friends that are participants (excluding current user)
      const participantFriends = expense.participants.filter(p => p.user_email !== user.email)
      
      // Set selected friends based on participants
      const selectedFriendsFromExpense = participantFriends.map(p => ({
        id: '', // We don't have the friend ID from participants
        user_id: '',
        friend_email: p.user_email,
        friend_name: p.user_name,
        status: 'accepted' as const,
        created_at: ''
      }))
      
      setSelectedFriends(selectedFriendsFromExpense)
      
      // Set split data
      const newPercentages: { [key: string]: number } = {}
      const newCustomAmounts: { [key: string]: number } = {}
      const newShares: { [key: string]: number } = {}
      
      expense.participants.forEach(p => {
        if (p.percentage != null) newPercentages[p.user_email] = p.percentage
        if (p.amount_owed != null) newCustomAmounts[p.user_email] = p.amount_owed
        if (p.shares != null) newShares[p.user_email] = p.shares
      })
      
      setPercentages(newPercentages)
      setCustomAmounts(newCustomAmounts)
      setShares(newShares)
    }
  }, [expense, user])

  const fetchFriends = async () => {
    try {
      const friendsList = await splitwiseService.getFriends()
      setFriends(friendsList)
    } catch (error) {
      console.error('Error fetching friends:', error)
    }
  }

  const fetchGroupMembers = async (groupId: string) => {
    if (!groupId) {
      setGroupMembers([])
      return
    }

    try {
      const group = groups.find(g => g.id === groupId)
      if (group) {
        // Get group members from context
        const { getGroupMembers } = await import('../../contexts/GroupContext')
        // For now, we'll use a simplified approach
        setGroupMembers([])
        toast('Group member integration coming soon!')
      }
    } catch (error) {
      console.error('Error fetching group members:', error)
    }
  }

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId)
    setValue('group_id', groupId)
    
    if (groupId) {
      fetchGroupMembers(groupId)
      // Clear current friend selections when switching to group mode
      setSelectedFriends([])
    } else {
      setGroupMembers([])
    }
  }

  const addFriend = (friend: Friend) => {
    if (selectedFriends.find(f => f.friend_email === friend.friend_email)) return
    setSelectedFriends([...selectedFriends, friend])
  }

  const removeFriend = (friendEmail: string) => {
    setSelectedFriends(selectedFriends.filter(f => f.friend_email !== friendEmail))
    
    // Clean up split data
    const newPercentages = { ...percentages }
    const newCustomAmounts = { ...customAmounts }
    const newShares = { ...shares }
    delete newPercentages[friendEmail]
    delete newCustomAmounts[friendEmail]
    delete newShares[friendEmail]
    setPercentages(newPercentages)
    setCustomAmounts(newCustomAmounts)
    setShares(newShares)
  }

  const updatePercentage = (email: string, percentage: number) => {
    setPercentages(prev => ({ ...prev, [email]: percentage }))
  }

  const updateCustomAmount = (email: string, amount: number) => {
    setCustomAmounts(prev => ({ ...prev, [email]: amount }))
  }

  const updateShares = (email: string, shareCount: number) => {
    setShares(prev => ({ ...prev, [email]: shareCount }))
  }

  // Get all participants including current user
  const getAllParticipants = () => {
    const participants = [
      {
        user_email: user?.email || '',
        user_name: user?.email?.split('@')[0] || 'You',
        isCurrentUser: true
      },
      ...selectedFriends.map(friend => ({
        user_email: friend.friend_email,
        user_name: friend.friend_name,
        isCurrentUser: false
      })),
      ...groupMembers.map(member => ({
        user_email: member.user_email,
        user_name: member.user_name,
        isCurrentUser: member.user_email === user?.email
      }))
    ]
    
    // Remove duplicates based on email
    const uniqueParticipants = participants.filter((participant, index, self) => 
      index === self.findIndex(p => p.user_email === participant.user_email)
    )
    
    return uniqueParticipants
  }

  const validateSplit = () => {
    const allParticipants = getAllParticipants()
    
    if (allParticipants.length < 2) {
      toast.error('Please add at least one friend or select a group to split with')
      return false
    }

    if (splitMethod === 'percentage') {
      const totalPercentage = allParticipants.reduce((sum, p) => sum + (percentages[p.user_email] || 0), 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast.error('Percentages must add up to 100%')
        return false
      }
    }

    if (splitMethod === 'custom') {
      const totalCustom = allParticipants.reduce((sum, p) => sum + (customAmounts[p.user_email] || 0), 0)
      if (Math.abs(totalCustom - totalAmount) > 0.01) {
        toast.error('Custom amounts must add up to the total amount')
        return false
      }
    }

    return true
  }

  const handleFormSubmit = async (data: SharedExpenseFormData) => {
    if (!validateSplit()) return

    setLoading(true)
    try {
      const allParticipants = getAllParticipants()
      
      // Calculate amounts for each participant
      let participantsWithAmounts = allParticipants.map(p => {
        let amount_owed = 0
        let percentage = undefined
        let shareCount = undefined

        if (splitMethod === 'equal') {
          amount_owed = totalAmount / allParticipants.length
        } else if (splitMethod === 'percentage') {
          percentage = percentages[p.user_email] || 0
          amount_owed = (totalAmount * percentage) / 100
        } else if (splitMethod === 'custom') {
          amount_owed = customAmounts[p.user_email] || 0
        } else if (splitMethod === 'shares') {
          shareCount = shares[p.user_email] || 1
          const totalShares = allParticipants.reduce((sum, participant) => sum + (shares[participant.user_email] || 1), 0)
          amount_owed = (totalAmount * shareCount) / totalShares
        }

        return {
          user_email: p.user_email,
          user_name: p.user_name,
          amount_owed,
          percentage,
          shares: shareCount
        }
      })

      const expenseData = {
        title: data.title,
        description: data.description,
        total_amount: data.total_amount,
        category: data.category,
        date: new Date(data.date).toISOString(),
        split_method: splitMethod,
        participants: participantsWithAmounts,
        group_id: selectedGroupId || undefined
      }

      if (expense) {
        await splitwiseService.updateSharedExpense(expense.id, expenseData)
        toast.success('Shared expense updated successfully!')
      } else {
        await splitwiseService.createSharedExpense(expenseData)
        toast.success('Shared expense created successfully!')
      }

      onSubmit()
    } catch (error: any) {
      console.error('Error saving shared expense:', error)
      toast.error(error.message || 'Error saving shared expense')
    } finally {
      setLoading(false)
    }
  }

  const renderSplitInputs = () => {
    const allParticipants = getAllParticipants()

    if (splitMethod === 'equal') {
      const amountPerPerson = totalAmount / allParticipants.length
      return (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Each person pays: ${amountPerPerson.toFixed(2)}
          </p>
          <div className="space-y-1">
            {allParticipants.map((participant, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {participant.isCurrentUser ? 'You' : participant.user_name}
                </span>
                <span className="font-medium">${amountPerPerson.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (splitMethod === 'percentage') {
      const totalPercentage = allParticipants.reduce((sum, p) => sum + (percentages[p.user_email] || 0), 0)
      return (
        <div className="space-y-3">
          {allParticipants.map((participant, index) => {
            const percentage = percentages[participant.user_email] || 0
            const amount = (totalAmount * percentage) / 100
            return (
              <div key={index} className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700 w-24">
                  {participant.isCurrentUser ? 'You' : participant.user_name}
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => updatePercentage(participant.user_email, parseFloat(e.target.value) || 0)}
                  className="input-field w-20"
                  placeholder="0"
                />
                <span className="text-sm text-gray-600">% = ${amount.toFixed(2)}</span>
              </div>
            )
          })}
          <p className={`text-sm ${Math.abs(totalPercentage - 100) < 0.01 ? 'text-success-600' : 'text-error-600'}`}>
            Total: {totalPercentage.toFixed(1)}%
          </p>
        </div>
      )
    }

    if (splitMethod === 'custom') {
      const totalCustom = allParticipants.reduce((sum, p) => sum + (customAmounts[p.user_email] || 0), 0)
      return (
        <div className="space-y-3">
          {allParticipants.map((participant, index) => (
            <div key={index} className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 w-24">
                {participant.isCurrentUser ? 'You' : participant.user_name}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customAmounts[participant.user_email] || 0}
                onChange={(e) => updateCustomAmount(participant.user_email, parseFloat(e.target.value) || 0)}
                className="input-field w-32"
                placeholder="0.00"
              />
            </div>
          ))}
          <p className={`text-sm ${Math.abs(totalCustom - totalAmount) < 0.01 ? 'text-success-600' : 'text-error-600'}`}>
            Total: ${totalCustom.toFixed(2)} / ${totalAmount.toFixed(2)}
          </p>
        </div>
      )
    }

    if (splitMethod === 'shares') {
      const totalShares = allParticipants.reduce((sum, p) => sum + (shares[p.user_email] || 1), 0)
      return (
        <div className="space-y-3">
          {allParticipants.map((participant, index) => {
            const shareCount = shares[participant.user_email] || 1
            const amount = (totalAmount * shareCount) / totalShares
            return (
              <div key={index} className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700 w-24">
                  {participant.isCurrentUser ? 'You' : participant.user_name}
                </span>
                <input
                  type="number"
                  min="1"
                  value={shareCount}
                  onChange={(e) => updateShares(participant.user_email, parseInt(e.target.value) || 1)}
                  className="input-field w-20"
                  placeholder="1"
                />
                <span className="text-sm text-gray-600">shares = ${amount.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Splitwise Notice */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-purple-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-purple-800">Splitwise Expense</h4>
            <p className="text-sm text-purple-700 mt-1">
              This is a bill-splitting expense separate from your personal and group finances. Perfect for restaurant bills, shared purchases, or any expense with friends.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expense Title *
        </label>
        <input
          {...register('title')}
          type="text"
          className="input-field"
          placeholder="Dinner at restaurant"
        />
        {errors.title && (
          <p className="text-error-600 text-sm mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={2}
          className="input-field"
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Amount *
          </label>
          <input
            {...register('total_amount', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            className="input-field"
            placeholder="0.00"
          />
          {errors.total_amount && (
            <p className="text-error-600 text-sm mt-1">{errors.total_amount.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category *
          </label>
          <select {...register('category')} className="input-field">
            <option value="">Select category</option>
            {CATEGORIES.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          {errors.category && (
            <p className="text-error-600 text-sm mt-1">{errors.category.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
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

      {/* Group Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Split with Group (Optional)
        </label>
        <select
          value={selectedGroupId}
          onChange={(e) => handleGroupChange(e.target.value)}
          className="input-field"
        >
          <option value="">Select a group (or add individual friends below)</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.member_count} members)
            </option>
          ))}
        </select>
        {selectedGroupId && (
          <p className="text-sm text-blue-600 mt-1">
            ✓ Selected group: {groups.find(g => g.id === selectedGroupId)?.name}
          </p>
        )}
      </div>

      {/* Friends Selection (only show if no group selected) */}
      {!selectedGroupId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Friends to Split With
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{friend.friend_name} ({friend.friend_email})</span>
                <button
                  type="button"
                  onClick={() => addFriend(friend)}
                  disabled={selectedFriends.find(f => f.friend_email === friend.friend_email)}
                  className="btn-primary text-xs py-1 px-2 disabled:opacity-50"
                >
                  {selectedFriends.find(f => f.friend_email === friend.friend_email) ? 'Added' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Splitting With ({getAllParticipants().length} people)
        </label>
        <div className="space-y-2">
          {/* Current User (always included) */}
          <div className="flex items-center justify-between p-2 bg-purple-50 rounded border-2 border-purple-200">
            <span className="text-sm font-medium">You ({user?.email})</span>
            <span className="text-xs text-purple-600 font-medium">Payer</span>
          </div>
          
          {/* Selected Friends */}
          {!selectedGroupId && selectedFriends.map((friend, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">{friend.friend_name}</span>
              <button
                type="button"
                onClick={() => removeFriend(friend.friend_email)}
                className="text-error-600 hover:text-error-700"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Group Members */}
          {selectedGroupId && groupMembers.map((member, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <span className="text-sm">{member.user_name}</span>
              <span className="text-xs text-blue-600 font-medium">Group Member</span>
            </div>
          ))}
        </div>
      </div>

      {getAllParticipants().length >= 2 && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Split Method *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'equal', label: 'Equal' },
                { value: 'percentage', label: 'Percentage' },
                { value: 'custom', label: 'Custom' },
                { value: 'shares', label: 'Shares' }
              ].map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setSplitMethod(method.value as any)}
                  className={`p-2 text-sm font-medium rounded border transition-colors ${
                    splitMethod === method.value
                      ? 'bg-purple-50 border-purple-600 text-purple-700'
                      : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {totalAmount > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Split Details
              </label>
              <div className="bg-gray-50 rounded-lg p-4">
                {renderSplitInputs()}
              </div>
            </div>
          )}
        </>
      )}

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
          <span>{expense ? 'Update' : 'Create'} Shared Expense</span>
        </button>
      </div>
    </form>
  )
}

export default SharedExpenseForm