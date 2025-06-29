import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export interface Group {
  id: string
  name: string
  description?: string
  created_by: string
  group_type: 'family' | 'friends' | 'roommates' | 'team' | 'other'
  currency: string
  created_at: string
  updated_at: string
  member_role?: 'admin' | 'member'
  member_count?: number
}

export interface GroupMember {
  id: string
  group_id: string
  user_email: string
  user_name: string
  role: 'admin' | 'member'
  status: 'active' | 'inactive' | 'pending'
  joined_at: string
}

interface GroupContextType {
  groups: Group[]
  currentGroup: Group | null
  isGroupMode: boolean
  loading: boolean
  setCurrentGroup: (group: Group | null) => void
  setIsGroupMode: (isGroup: boolean) => void
  refreshGroups: () => Promise<void>
  createGroup: (groupData: Omit<Group, 'id' | 'created_by' | 'created_at' | 'updated_at'>) => Promise<Group>
  updateGroup: (groupId: string, updates: Partial<Group>) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  addGroupMember: (groupId: string, email: string, name: string, role?: 'admin' | 'member') => Promise<void>
  removeGroupMember: (groupId: string, memberEmail: string) => Promise<void>
  getGroupMembers: (groupId: string) => Promise<GroupMember[]>
}

const GroupContext = createContext<GroupContextType | undefined>(undefined)

export function useGroup() {
  const context = useContext(GroupContext)
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}

interface GroupProviderProps {
  children: React.ReactNode
}

export function GroupProvider({ children }: GroupProviderProps) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null)
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      refreshGroups()
    } else {
      setGroups([])
      setCurrentGroup(null)
      setIsGroupMode(false)
      setLoading(false)
    }
  }, [user])

  // Clear current group when switching to personal mode
  useEffect(() => {
    if (!isGroupMode) {
      setCurrentGroup(null)
    }
  }, [isGroupMode])

  const refreshGroups = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      // First, get user's group memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('group_members')
        .select('group_id, role, status')
        .eq('user_email', user.email)
        .eq('status', 'active')

      if (membershipsError) throw membershipsError

      if (!memberships || memberships.length === 0) {
        setGroups([])
        setLoading(false)
        return
      }

      // Get the group IDs
      const groupIds = memberships.map(m => m.group_id)

      // Fetch groups data separately
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)

      if (groupsError) throw groupsError

      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('status', 'active')

          // Find the user's role in this group
          const membership = memberships.find(m => m.group_id === group.id)

          return {
            ...group,
            member_role: membership?.role,
            member_count: count || 0
          }
        })
      )

      setGroups(groupsWithCounts)
    } catch (error) {
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async (groupData: Omit<Group, 'id' | 'created_by' | 'created_at' | 'updated_at'>): Promise<Group> => {
    if (!user) throw new Error('Not authenticated')

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        ...groupData,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    // Add creator as admin member
    await supabase
      .from('group_members')
      .insert({
        group_id: group.id,
        user_email: user.email!,
        user_name: user.email!.split('@')[0],
        role: 'admin',
        status: 'active',
        invited_by: user.id
      })

    await refreshGroups()
    return group
  }

  const updateGroup = async (groupId: string, updates: Partial<Group>) => {
    const { error } = await supabase
      .from('groups')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', groupId)

    if (error) throw error
    await refreshGroups()
  }

  const deleteGroup = async (groupId: string) => {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (error) throw error
    
    if (currentGroup?.id === groupId) {
      setCurrentGroup(null)
      setIsGroupMode(false)
    }
    
    await refreshGroups()
  }

  const addGroupMember = async (groupId: string, email: string, name: string, role: 'admin' | 'member' = 'member') => {
    if (!user) throw new Error('Not authenticated')

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_email', email)
      .single()

    if (existingMember) {
      throw new Error('User is already a member of this group')
    }

    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_email: email,
        user_name: name,
        role,
        status: 'active',
        invited_by: user.id
      })

    if (error) throw error
    await refreshGroups()
  }

  const removeGroupMember = async (groupId: string, memberEmail: string) => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_email', memberEmail)

    if (error) throw error
    await refreshGroups()
  }

  const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('joined_at')

    if (error) throw error
    return data || []
  }

  const value = {
    groups,
    currentGroup,
    isGroupMode,
    loading,
    setCurrentGroup,
    setIsGroupMode,
    refreshGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    getGroupMembers
  }

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}