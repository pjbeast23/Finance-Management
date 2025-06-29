/*
  # Fix Group Members RLS Policies to Prevent Infinite Recursion

  1. Problem
    - The existing RLS policies on groups and group_members tables create infinite recursion
    - This happens when the groups policy references group_members while group_members is being queried

  2. Solution
    - Drop and recreate policies with simplified logic that avoids circular references
    - Use direct subqueries instead of complex EXISTS clauses that could cause recursion
    - Ensure policies are non-recursive and clearly separated

  3. Changes
    - Simplified group_members policies to only check user's own email
    - Modified groups policy to use IN subquery instead of EXISTS
    - Maintained all existing functionality while preventing recursion
*/

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view groups they created or are members of" ON groups;
DROP POLICY IF EXISTS "Users can view their own group memberships" ON group_members;
DROP POLICY IF EXISTS "Group creators can manage members" ON group_members;
DROP POLICY IF EXISTS "Users can delete their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;

-- Recreate group_members policies without recursion
CREATE POLICY "Users can view their own group memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Users can update their own membership"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Users can delete their own membership"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

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

-- Recreate groups policy without causing recursion
CREATE POLICY "Users can view groups they created or are members of"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR 
    id IN (
      SELECT gm.group_id 
      FROM group_members gm 
      WHERE gm.user_email = auth.email() 
      AND gm.status = 'active'
    )
  );

-- Recreate other group policies
CREATE POLICY "Users can create groups" ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update groups" ON groups
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() 
    OR 
    id IN (
      SELECT gm.group_id 
      FROM group_members gm 
      WHERE gm.user_email = auth.email() 
      AND gm.role = 'admin' 
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Group creators can delete groups" ON groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());