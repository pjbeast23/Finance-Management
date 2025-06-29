/*
  # Fix infinite recursion in group_members RLS policies

  1. Problem
    - Current RLS policies on group_members table are causing infinite recursion
    - Policies are referencing the same table they're protecting within their conditions
    - This creates circular dependencies when querying group_members

  2. Solution
    - Drop existing problematic policies
    - Create new policies with simplified logic that avoid self-referencing
    - Use direct conditions instead of complex subqueries that trigger recursion

  3. Changes
    - Remove policies that query group_members within their own conditions
    - Create simpler policies based on direct user authentication
    - Ensure group creators and members can access data without circular references
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Group creators can add members" ON group_members;
DROP POLICY IF EXISTS "Group creators can manage all members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Users can update own membership" ON group_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON group_members;

-- Create new policies without recursion

-- Policy 1: Users can view their own membership records
CREATE POLICY "Users can view their own memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

-- Policy 2: Users can view memberships in groups they created
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

-- Policy 3: Group creators can insert new members
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

-- Policy 4: Group creators can update any member
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

-- Policy 5: Users can update their own membership status
CREATE POLICY "Users can update own membership"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Policy 6: Group creators can delete any member
CREATE POLICY "Group creators can delete members"
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

-- Policy 7: Users can leave groups (delete their own membership)
CREATE POLICY "Users can leave groups"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());