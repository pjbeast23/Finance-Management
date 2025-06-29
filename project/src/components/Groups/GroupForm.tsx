import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useGroup } from '../../contexts/GroupContext'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

const GROUP_TYPES = [
  { value: 'family', label: 'Family' },
  { value: 'friends', label: 'Friends' },
  { value: 'roommates', label: 'Roommates' },
  { value: 'team', label: 'Team' },
  { value: 'other', label: 'Other' }
]

const groupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50, 'Name too long'),
  description: z.string().optional(),
  group_type: z.enum(['family', 'friends', 'roommates', 'team', 'other']),
  currency: z.string().default('USD')
})

type GroupFormData = z.infer<typeof groupSchema>

interface GroupFormProps {
  onSubmit: () => void
  onCancel: () => void
}

const GroupForm: React.FC<GroupFormProps> = ({ onSubmit, onCancel }) => {
  const { createGroup } = useGroup()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      group_type: 'family',
      currency: 'USD'
    }
  })

  const handleFormSubmit = async (data: GroupFormData) => {
    setLoading(true)
    try {
      await createGroup(data)
      toast.success('Group created successfully!')
      onSubmit()
    } catch (error: any) {
      console.error('Error creating group:', error)
      toast.error(error.message || 'Error creating group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Group Name *
        </label>
        <input
          {...register('name')}
          type="text"
          className="input-field"
          placeholder="My Family Budget"
        />
        {errors.name && (
          <p className="text-error-600 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Group Type *
        </label>
        <select {...register('group_type')} className="input-field">
          {GROUP_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        {errors.group_type && (
          <p className="text-error-600 text-sm mt-1">{errors.group_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="input-field"
          placeholder="Optional description for your group"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Currency
        </label>
        <select {...register('currency')} className="input-field">
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
          <option value="JPY">JPY (¥)</option>
          <option value="CAD">CAD (C$)</option>
          <option value="AUD">AUD (A$)</option>
        </select>
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
          <span>Create Group</span>
        </button>
      </div>
    </form>
  )
}

export default GroupForm