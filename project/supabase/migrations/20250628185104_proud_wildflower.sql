/*
  # Fix RLS Policy Infinite Recursion

  1. Problem
    - Current policies create circular dependencies between groups and group_members tables
    - Groups policies check group_members, which check groups, causing infinite recursion

  2. Solution
    - Restructure policies to avoid circular references
    - Use direct user ID checks where possible
    - Simplify policy logic to prevent recursive lookups

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that don't create circular dependencies
    - Ensure proper access control without recursion
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view groups they created or are members of" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;

DROP POLICY IF EXISTS "Group admins can add members" ON group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
DROP POLICY IF EXISTS "Group admins can view members" ON group_members;
DROP POLICY IF EXISTS "Group creators can add members" ON group_members;
DROP POLICY IF EXISTS "Group creators can remove members" ON group_members;
DROP POLICY IF EXISTS "Group creators can update members" ON group_members;
DROP POLICY IF EXISTS "Group creators can view all members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Users can update own membership" ON group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON group_members;

-- Create new simplified policies for groups table
CREATE POLICY "Users can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can view their groups"
  ON groups
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Group creators can update their groups"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can delete their groups"
  ON groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create new simplified policies for group_members table
CREATE POLICY "Users can view their own memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Users can update their own membership status"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Users can leave groups"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

-- Policies for group creators to manage members
CREATE POLICY "Group creators can manage all members"
  ON group_members
  FOR ALL
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

-- Create a separate policy for members to view groups they belong to
-- This uses a function to avoid recursion
CREATE OR REPLACE FUNCTION user_can_view_group(group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = $1
    AND gm.user_email = auth.email()
    AND gm.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = $1
    AND g.created_by = auth.uid()
  );
$$;

CREATE POLICY "Members can view groups they belong to"
  ON groups
  FOR SELECT
  TO authenticated
  USING (user_can_view_group(id));

-- Create a function to check if user is admin of a group
CREATE OR REPLACE FUNCTION user_is_group_admin(group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = $1
    AND gm.user_email = auth.email()
    AND gm.role = 'admin'
    AND gm.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = $1
    AND g.created_by = auth.uid()
  );
$$;

-- Policy for group admins to update groups
CREATE POLICY "Group admins can update groups"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (user_is_group_admin(id))
  WITH CHECK (user_is_group_admin(id));

-- Policy for group admins to manage members
CREATE POLICY "Group admins can manage members"
  ON group_members
  FOR ALL
  TO authenticated
  USING (
    user_is_group_admin(group_id) AND 
    user_email != auth.email() -- Admins can't modify their own membership through this policy
  )
  WITH CHECK (
    user_is_group_admin(group_id) AND 
    user_email != auth.email()
  );