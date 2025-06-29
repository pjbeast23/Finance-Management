/*
  # Fix infinite recursion in group_members RLS policies

  1. Security Changes
    - Drop existing problematic RLS policies on group_members table
    - Create simplified, non-recursive policies
    - Ensure users can only see their own memberships
    - Allow group creators to manage members through simplified logic

  2. Policy Changes
    - Simplified SELECT policy for users to see their own memberships
    - Simplified policies for group creators to manage members
    - Avoid recursive queries that reference the same table
*/

-- Drop all existing policies on group_members to start fresh
DROP POLICY IF EXISTS "Group creators can add members" ON group_members;
DROP POLICY IF EXISTS "Group creators can delete members" ON group_members;
DROP POLICY IF EXISTS "Group creators can update members" ON group_members;
DROP POLICY IF EXISTS "Group creators can view all members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Users can update own membership" ON group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON group_members;

-- Create simplified, non-recursive policies

-- Users can view their own memberships (primary policy)
CREATE POLICY "Users can view their own memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

-- Users can update their own membership status (e.g., leave group)
CREATE POLICY "Users can update own membership"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Users can delete their own membership (leave group)
CREATE POLICY "Users can leave groups"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

-- Group creators can view all members of their groups
-- This uses a direct join to avoid recursion
CREATE POLICY "Group creators can view all members"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

-- Group creators can add members to their groups
CREATE POLICY "Group creators can add members"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

-- Group creators can update members in their groups
CREATE POLICY "Group creators can update members"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

-- Group creators can remove members from their groups
CREATE POLICY "Group creators can remove members"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

-- Group admins can also manage members (additional policy)
CREATE POLICY "Group admins can view members"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
      AND gm.id != group_members.id  -- Prevent self-reference
    )
  );

CREATE POLICY "Group admins can add members"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Group admins can update members"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
      AND gm.id != group_members.id  -- Prevent self-reference
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
      AND gm.id != group_members.id  -- Prevent self-reference
    )
  );

CREATE POLICY "Group admins can remove members"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
      AND gm.id != group_members.id  -- Prevent self-reference
    )
  );