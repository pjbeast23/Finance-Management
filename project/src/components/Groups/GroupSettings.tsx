import React, { useState, useEffect } from 'react'
import { useGroup, Group, GroupMember } from '../../contexts/GroupContext'
import { Users, Plus, Trash2, Crown, Mail, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

interface GroupSettingsProps {
  group: Group
  onClose: () => void
}

const GroupSettings: React.FC<GroupSettingsProps> = ({ group, onClose }) => {
  const { 
    deleteGroup, 
    addGroupMember, 
    removeGroupMember, 
    getGroupMembers
  } = useGroup()
  
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [group.id])

  const fetchMembers = async () => {
    try {
      const membersData = await getGroupMembers(group.id)
      setMembers(membersData)
    } catch (error) {
      console.error('Error fetching members:', error)
      toast.error('Error loading group members')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberEmail || !newMemberName) {
      toast.error('Please fill in both email and name')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newMemberEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    setAddingMember(true)
    try {
      await addGroupMember(group.id, newMemberEmail.toLowerCase().trim(), newMemberName.trim())
      toast.success(`${newMemberName} has been added to the group!`)
      setNewMemberEmail('')
      setNewMemberName('')
      setShowAddForm(false)
      fetchMembers()
    } catch (error: any) {
      console.error('Error adding member:', error)
      if (error.message.includes('already a member')) {
        toast.error('This user is already a member of the group')
      } else {
        toast.error(error.message || 'Error adding member')
      }
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberEmail: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the group?`)) return

    try {
      await removeGroupMember(group.id, memberEmail)
      toast.success(`${memberName} has been removed from the group`)
      fetchMembers()
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast.error(error.message || 'Error removing member')
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone and will delete all group data including expenses and investments.`)) return

    try {
      await deleteGroup(group.id)
      toast.success('Group deleted successfully!')
      onClose()
    } catch (error: any) {
      console.error('Error deleting group:', error)
      toast.error(error.message || 'Error deleting group')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Group Info */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Group Information</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2 capitalize">{group.group_type}</span>
            </div>
            <div>
              <span className="text-gray-600">Currency:</span>
              <span className="ml-2">{group.currency}</span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2">{new Date(group.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Members:</span>
              <span className="ml-2">{members.length}</span>
            </div>
          </div>
          {group.description && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-gray-600">Description:</span>
              <p className="mt-1 text-gray-900">{group.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Members Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Members ({members.length})</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary flex items-center space-x-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member</span>
          </button>
        </div>
        
        {/* Add Member Form */}
        {showAddForm && (
          <form onSubmit={handleAddMember} className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Add New Member</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="John Doe"
                  className="input-field"
                  required
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={addingMember}
                  className="btn-primary flex items-center space-x-2"
                >
                  {addingMember ? <LoadingSpinner size="sm" /> : <Plus className="h-4 w-4" />}
                  <span>Add Member</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setNewMemberEmail('')
                    setNewMemberName('')
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Members List */}
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-full">
                  {member.role === 'admin' ? (
                    <Crown className="h-4 w-4 text-primary-600" />
                  ) : (
                    <Users className="h-4 w-4 text-primary-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.user_name}</p>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Mail className="h-3 w-3 mr-1" />
                    {member.user_email}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  member.role === 'admin' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {member.role}
                </span>
                {member.role !== 'admin' && group.member_role === 'admin' && (
                  <button
                    onClick={() => handleRemoveMember(member.user_email, member.user_name)}
                    className="p-1 text-gray-400 hover:text-error-600 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No members yet. Add some members to get started!</p>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {group.member_role === 'admin' && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Danger Zone</h3>
          <div className="bg-error-50 border border-error-200 rounded-lg p-4">
            <h4 className="font-medium text-error-800 mb-2">Delete Group</h4>
            <p className="text-sm text-error-700 mb-4">
              This will permanently delete the group and all associated data including expenses, investments, and member information. This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteGroup}
              className="bg-error-600 hover:bg-error-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Delete Group
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="btn-secondary"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default GroupSettings