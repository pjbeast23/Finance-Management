import { useState } from 'react'
import { useGroup } from '../../contexts/GroupContext'
import { Users, Plus, Settings, ChevronDown, User, UserPlus } from 'lucide-react'
import Modal from '../UI/Modal'
import GroupForm from './GroupForm'
import GroupSettings from './GroupSettings'
import AddMemberForm from './AddMemberForm'

const GroupSelector = () => {
  const { 
    groups, 
    currentGroup, 
    isGroupMode, 
    setCurrentGroup, 
    setIsGroupMode 
  } = useGroup()
  
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)

  const handleModeToggle = (groupMode: boolean) => {
    setIsGroupMode(groupMode)
    if (!groupMode) {
      setCurrentGroup(null)
    }
    setShowDropdown(false)
  }

  const handleGroupSelect = (group: any) => {
    setCurrentGroup(group)
    setIsGroupMode(true)
    setShowDropdown(false)
  }

  const handleCreateGroup = () => {
    setShowCreateModal(true)
    setShowDropdown(false)
  }

  const handleSettings = () => {
    setShowSettingsModal(true)
    setShowDropdown(false)
  }

  const handleAddMember = (group: any) => {
    setCurrentGroup(group)
    setShowAddMemberModal(true)
    setShowDropdown(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
      >
        {isGroupMode && currentGroup ? (
          <>
            <Users className="h-4 w-4 text-primary-600" />
            <span className="font-medium text-gray-900">{currentGroup.name}</span>
          </>
        ) : (
          <>
            <User className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-900">Personal</span>
          </>
        )}
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {/* Personal Mode */}
            <button
              onClick={() => handleModeToggle(false)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                !isGroupMode ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
              }`}
            >
              <User className="h-4 w-4" />
              <span className="font-medium">Personal</span>
            </button>

            {/* Groups Section */}
            {groups.length > 0 && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <div className="px-3 py-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Groups
                  </span>
                </div>
                {groups.map((group) => (
                  <div key={group.id} className="group">
                    <div
                      className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                        currentGroup?.id === group.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-100'
                      }`}
                    >
                      <button
                        onClick={() => handleGroupSelect(group)}
                        className="flex-1 flex items-center space-x-3 text-left"
                      >
                        <Users className="h-4 w-4" />
                        <div>
                          <span className="font-medium">{group.name}</span>
                          <div className="text-xs text-gray-500 capitalize">
                            {group.group_type} • {group.member_count} members
                          </div>
                        </div>
                      </button>
                      
                      {/* Action buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAddMember(group)
                          }}
                          className="p-1 hover:bg-gray-200 rounded text-green-600 hover:text-green-700"
                          title="Add member"
                        >
                          <UserPlus className="h-3 w-3" />
                        </button>
                        
                        {group.member_role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentGroup(group)
                              handleSettings()
                            }}
                            className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-700"
                            title="Group settings"
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Create Group */}
            <div className="border-t border-gray-200 my-2"></div>
            <button
              onClick={handleCreateGroup}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-4 w-4 text-primary-600" />
              <span className="font-medium text-primary-600">Create Group</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
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

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title={`Add Member to ${currentGroup?.name}`}
      >
        <AddMemberForm
          group={currentGroup}
          onSubmit={() => setShowAddMemberModal(false)}
          onCancel={() => setShowAddMemberModal(false)}
        />
      </Modal>

      {/* Group Settings Modal */}
      {currentGroup && (
        <Modal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          title={`${currentGroup.name} Settings`}
        >
          <GroupSettings
            group={currentGroup}
            onClose={() => setShowSettingsModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}

export default GroupSelector