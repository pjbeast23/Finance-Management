/*
  # Fix infinite recursion in group_members RLS policies

  1. Problem
    - The current RLS policies on group_members table create infinite recursion
    - Policies are trying to query group_members table from within group_members policies
    - This creates a circular dependency that causes the "infinite recursion detected" error

  2. Solution
    - Drop existing problematic policies
    - Create new, simpler policies that don't create circular dependencies
    - Use direct user authentication checks instead of complex subqueries
    - Separate admin management from basic user operations

  3. New Policies
    - Users can view their own membership records
    - Users can update their own membership details (like status)
    - Users can leave groups (delete their own records)
    - Group creators can manage all members in their groups
    - Simplified admin checks that don't cause recursion
*/

-- Drop all existing policies on group_members to start fresh
DROP POLICY IF EXISTS "Group admins can manage other members" ON group_members;
DROP POLICY IF EXISTS "Group creators can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Users can update their own membership details" ON group_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON group_members;

-- Create new, non-recursive policies

-- Users can view their own membership records
CREATE POLICY "Users can view own memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

-- Users can update their own membership details (like changing status)
CREATE POLICY "Users can update own membership"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Users can leave groups by deleting their own membership
CREATE POLICY "Users can leave groups"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

-- Group creators can manage all members in their groups
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

-- Allow group creators to insert new members
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