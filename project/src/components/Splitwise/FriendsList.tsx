import React, { useState, useEffect } from 'react'
import { SplitwiseService, Friend } from '../../lib/splitwise'
import { Users, Plus, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import LoadingSpinner from '../UI/LoadingSpinner'

const FriendsList = () => {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFriend, setNewFriend] = useState({ email: '', name: '' })
  const [adding, setAdding] = useState(false)

  const splitwiseService = new SplitwiseService()

  useEffect(() => {
    fetchFriends()
  }, [])

  const fetchFriends = async () => {
    try {
      const friendsList = await splitwiseService.getFriends()
      setFriends(friendsList)
    } catch (error) {
      console.error('Error fetching friends:', error)
      toast.error('Error loading friends')
    } finally {
      setLoading(false)
    }
  }

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFriend.email || !newFriend.name) return

    setAdding(true)
    try {
      await splitwiseService.addFriend(newFriend.email, newFriend.name)
      toast.success('Friend added successfully!')
      setNewFriend({ email: '', name: '' })
      setShowAddForm(false)
      fetchFriends()
    } catch (error: any) {
      console.error('Error adding friend:', error)
      toast.error(error.message || 'Error adding friend')
    } finally {
      setAdding(false)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-medium text-gray-900">Friends</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Friend</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddFriend} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Friend's Email
            </label>
            <input
              type="email"
              value={newFriend.email}
              onChange={(e) => setNewFriend({ ...newFriend, email: e.target.value })}
              className="input-field"
              placeholder="friend@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Friend's Name
            </label>
            <input
              type="text"
              value={newFriend.name}
              onChange={(e) => setNewFriend({ ...newFriend, name: e.target.value })}
              className="input-field"
              placeholder="John Doe"
              required
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={adding}
              className="btn-primary flex items-center space-x-2"
            >
              {adding && <LoadingSpinner size="sm" />}
              <span>Add Friend</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {friends.length > 0 ? (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary-100 rounded-full">
                  <UserCheck className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{friend.friend_name}</p>
                  <p className="text-sm text-gray-600">{friend.friend_email}</p>
                </div>
              </div>
              <div className="text-sm text-success-600 font-medium">
                Connected
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No friends yet</h3>
          <p className="text-gray-500 mb-4">
            Add friends to start splitting expenses together
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
          >
            Add Your First Friend
          </button>
        </div>
      )}
    </div>
  )
}

export default FriendsList