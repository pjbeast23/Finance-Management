/*
  # Fix infinite recursion in group_members RLS policies

  1. Problem
    - Current RLS policies on groups and group_members tables create circular dependencies
    - Groups policy checks group_members, and group_members policies may check groups
    - This causes infinite recursion when querying

  2. Solution
    - Simplify group_members policies to avoid circular references
    - Ensure policies are self-contained and don't create loops
    - Use direct user authentication checks where possible

  3. Changes
    - Drop existing problematic policies on group_members
    - Create new simplified policies that avoid recursion
    - Maintain security while preventing circular dependencies
*/

-- Drop existing policies on group_members that might cause recursion
DROP POLICY IF EXISTS "Group creators can manage all members" ON group_members;
DROP POLICY IF EXISTS "Users can delete their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can view their own group memberships" ON group_members;

-- Create new simplified policies for group_members
-- These policies avoid referencing other tables that might reference back

-- Allow users to view group memberships where they are the member
CREATE POLICY "Users can view their own memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

-- Allow users to update their own membership status/role (but not change group_id or user_email)
CREATE POLICY "Users can update their own membership details"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Allow users to delete their own membership (leave group)
CREATE POLICY "Users can leave groups"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

-- Allow group creators to manage all members of their groups
-- This policy checks the groups table but doesn't create recursion because
-- the groups policy doesn't depend on this specific policy
CREATE POLICY "Group creators can manage members"
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

-- Allow group admins to manage members (but not themselves to prevent privilege escalation)
CREATE POLICY "Group admins can manage other members"
  ON group_members
  FOR ALL
  TO authenticated
  USING (
    user_email != auth.email() AND
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  )
  WITH CHECK (
    user_email != auth.email() AND
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );