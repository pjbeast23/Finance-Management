import React from 'react'
import { Users, Settings, UserPlus, Calendar } from 'lucide-react'
import { Group } from '../../contexts/GroupContext'

interface GroupCardProps {
  group: Group
  isSelected: boolean
  onSelect: () => void
  onSettings: () => void
  onAddMember: () => void
}

const GroupCard: React.FC<GroupCardProps> = ({ 
  group, 
  isSelected, 
  onSelect, 
  onSettings, 
  onAddMember 
}) => {
  return (
    <div className={`card cursor-pointer transition-all duration-200 ${
      isSelected 
        ? 'ring-2 ring-primary-500 bg-primary-50' 
        : 'hover:shadow-md hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={onSelect}>
          <div className="flex items-center space-x-3 mb-3">
            <div className={`p-2 rounded-full ${
              isSelected ? 'bg-primary-100' : 'bg-gray-100'
            }`}>
              <Users className={`h-5 w-5 ${
                isSelected ? 'text-primary-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{group.name}</h3>
              <p className="text-sm text-gray-600 capitalize">
                {group.group_type} group
              </p>
            </div>
          </div>

          {group.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {group.description}
            </p>
          )}

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{group.member_count} members</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddMember()
            }}
            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
            title="Add member"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          
          {group.member_role === 'admin' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSettings()
              }}
              className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              title="Group settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Role Badge */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          group.member_role === 'admin'
            ? 'bg-primary-100 text-primary-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {group.member_role === 'admin' ? '👑 Admin' : '👤 Member'}
        </span>
      </div>
    </div>
  )
}

export default GroupCard