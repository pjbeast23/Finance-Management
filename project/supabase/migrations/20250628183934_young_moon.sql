/*
  # Fix RLS infinite recursion in group policies

  1. Problem
    - The current RLS policies create circular dependencies between groups and group_members tables
    - When querying groups with group_members join, policies reference each other causing infinite recursion

  2. Solution
    - Simplify group_members SELECT policy to only check user_email directly
    - Keep groups SELECT policy as is since it's the primary entry point
    - This breaks the circular dependency while maintaining security

  3. Security
    - Users can only see group_members records where their email matches
    - Users can only see groups they created or are members of
    - No circular policy evaluation
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;

-- Create a simplified policy that doesn't create circular dependencies
CREATE POLICY "Users can view their own group memberships"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());