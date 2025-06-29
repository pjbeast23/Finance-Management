/*
  # Fix infinite recursion in shared_expenses RLS policies

  1. Problem
    - The current RLS policy for viewing shared expenses creates infinite recursion
    - Policy references expense_participants which may reference back to shared_expenses

  2. Solution
    - Drop the problematic policy that causes recursion
    - Simplify policies to avoid circular references
    - Keep the essential security while preventing infinite loops

  3. Changes
    - Remove the recursive policy for viewing shared expenses by participants
    - Keep the policy for creators to view their own shared expenses
    - Maintain other CRUD policies for creators
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view shared expenses they participate in" ON shared_expenses;

-- The remaining policies should be sufficient:
-- 1. "Users can view their shared expenses" - for creators
-- 2. "Users can insert their own shared expenses" - for creating
-- 3. "Users can update shared expenses they created" - for updating
-- 4. "Users can delete shared expenses they created" - for deleting

-- If we need participants to view shared expenses, we'll handle this at the application level
-- by joining with expense_participants in the query rather than in RLS policy