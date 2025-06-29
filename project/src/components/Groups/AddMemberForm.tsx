import React, { useState } from 'react'
import { useGroup } from '../../contexts/GroupContext'
import { UserPlus, Mail, User, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

interface AddMemberFormProps {
  group: any
  onSubmit: () => void
  onCancel: () => void
}

const AddMemberForm: React.FC<AddMemberFormProps> = ({ group, onSubmit, onCancel }) => {
  const { addGroupMember, refreshGroups } = useGroup()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !name.trim()) {
      toast.error('Please fill in both email and name')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      await addGroupMember(group.id, email.toLowerCase().trim(), name.trim())
      toast.success(`${name.trim()} has been added to ${group.name}!`)
      await refreshGroups()
      onSubmit()
    } catch (error: any) {
      console.error('Error adding member:', error)
      if (error.message.includes('already a member')) {
        toast.error('This user is already a member of the group')
      } else {
        toast.error(error.message || 'Error adding member')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Group Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <UserPlus className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-800">Adding Member to Group</h4>
            <p className="text-sm text-blue-700">
              Group: <strong>{group.name}</strong> • {group.member_count} current members
            </p>
          </div>
        </div>
      </div>

      {/* Add Member Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="inline h-4 w-4 mr-1" />
            Email Address *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            className="input-field"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            The email address of the person you want to add to the group
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline h-4 w-4 mr-1" />
            Display Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="input-field"
            required
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            How this person's name will appear in the group
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-gray-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-800">What happens next?</h4>
              <ul className="text-sm text-gray-600 mt-1 space-y-1">
                <li>• The member will be added to the group immediately</li>
                <li>• They can view and add group expenses and investments</li>
                <li>• They'll see shared financial data for this group</li>
                <li>• Only group admins can remove members</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            {loading ? <LoadingSpinner size="sm" /> : <UserPlus className="h-4 w-4" />}
            <span>Add Member</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddMemberForm