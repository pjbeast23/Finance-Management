/*
  # Fix infinite recursion in group_members RLS policies

  1. Problem
    - The "Group admins can manage members" policy creates infinite recursion
    - It queries group_members table within the group_members policy evaluation
    
  2. Solution
    - Drop the problematic policy
    - Create new policies that avoid self-referential queries
    - Use group creators and direct user email checks instead
    
  3. Security
    - Group creators can manage all members
    - Users can view their own memberships
    - Users can update their own status (for leaving groups)
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Group admins can manage members" ON group_members;

-- Create separate policies for different operations to avoid recursion

-- Group creators can manage all members of their groups
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

-- Users can view their own group memberships (already exists, but ensuring it's correct)
DROP POLICY IF EXISTS "Users can view their own group memberships" ON group_members;
CREATE POLICY "Users can view their own group memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

-- Users can update their own membership status (for leaving groups)
CREATE POLICY "Users can update their own membership"
  ON group_members
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

-- Users can delete their own membership (for leaving groups)
CREATE POLICY "Users can delete their own membership"
  ON group_members
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());