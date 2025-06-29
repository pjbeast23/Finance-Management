/*
  # Fix infinite recursion in expense_participants RLS policies

  1. Problem
    - Current policies on expense_participants table are causing infinite recursion
    - This happens when policies create circular dependencies between tables
    - The issue occurs when fetching shared_expenses with expense_participants

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that avoid circular references
    - Use direct user authentication checks instead of complex joins
*/

-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Expense creators can add participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can delete expense participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can update expense participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can view expense participants" ON expense_participants;

-- Create new simplified policies without circular references

-- Policy for INSERT: Only expense creators can add participants
CREATE POLICY "Expense creators can add participants" ON expense_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

-- Policy for SELECT: Users can view participants if they are the expense creator OR they are a participant
CREATE POLICY "Users can view expense participants" ON expense_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is the expense creator
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
    OR
    -- User is a participant in this expense
    user_email = auth.email()
  );

-- Policy for UPDATE: Expense creators can update any participant, participants can update themselves
CREATE POLICY "Users can update expense participants" ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (
    -- User is the expense creator
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
    OR
    -- User is updating their own participation
    user_email = auth.email()
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
    OR
    user_email = auth.email()
  );

-- Policy for DELETE: Expense creators can delete any participant, participants can remove themselves
CREATE POLICY "Users can delete expense participants" ON expense_participants
  FOR DELETE
  TO authenticated
  USING (
    -- User is the expense creator
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
    OR
    -- User is removing their own participation
    user_email = auth.email()
  );