import { useState } from 'react'
import { useGroup } from '../contexts/GroupContext'
import { Users, Plus, Search } from 'lucide-react'
import Modal from '../components/UI/Modal'
import GroupForm from '../components/Groups/GroupForm'
import GroupSettings from '../components/Groups/GroupSettings'
import AddMemberForm from '../components/Groups/AddMemberForm'
import GroupCard from '../components/Groups/GroupCard'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Groups = () => {
  const { groups, currentGroup, setCurrentGroup, setIsGroupMode, loading } = useGroup()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = !filterType || group.group_type === filterType
    return matchesSearch && matchesFilter
  })

  const handleGroupSelect = (group: any) => {
    setCurrentGroup(group)
    setIsGroupMode(true)
    setSelectedGroup(group)
  }

  const handleSettings = (group: any) => {
    setSelectedGroup(group)
    setShowSettingsModal(true)
  }

  const handleAddMember = (group: any) => {
    setSelectedGroup(group)
    setShowAddMemberModal(true)
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
          <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-600 mt-1">
            Manage your financial groups and collaborate with family, friends, or teammates
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Create Group</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="md:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field"
            >
              <option value="">All Types</option>
              <option value="family">Family</option>
              <option value="friends">Friends</option>
              <option value="roommates">Roommates</option>
              <option value="team">Team</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isSelected={currentGroup?.id === group.id}
              onSelect={() => handleGroupSelect(group)}
              onSettings={() => handleSettings(group)}
              onAddMember={() => handleAddMember(group)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType ? 'No groups found' : 'No groups yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || filterType 
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first group to start collaborating on finances'
            }
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Group
          </button>
        </div>
      )}

      {/* Modals */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Group"
      >
        <GroupForm
          onSubmit={() => setShowCreateModal(false)}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title={`Add Member to ${selectedGroup?.name}`}
      >
        <AddMemberForm
          group={selectedGroup}
          onSubmit={() => setShowAddMemberModal(false)}
          onCancel={() => setShowAddMemberModal(false)}
        />
      </Modal>

      {selectedGroup && (
        <Modal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          title={`${selectedGroup.name} Settings`}
        >
          <GroupSettings
            group={selectedGroup}
            onClose={() => setShowSettingsModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}

export default Groups