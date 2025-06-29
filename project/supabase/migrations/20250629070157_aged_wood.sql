/*
  # Fix infinite recursion in expense_participants RLS policies

  1. Problem
    - Current RLS policies on expense_participants table are causing infinite recursion
    - This happens when policies reference related tables that also have RLS policies
    - The SELECT policies are creating circular dependencies

  2. Solution
    - Drop existing problematic policies
    - Create new policies that avoid recursion by using direct conditions
    - Ensure policies allow users to view participants for expenses they created or are part of
    - Use auth.email() and auth.uid() directly without complex subqueries that could cause recursion

  3. Security
    - Users can view participants for expenses they created
    - Users can view their own participation records
    - Expense creators can manage all participants
    - Users can manage their own participation status
*/

-- Drop existing policies that are causing recursion
DROP POLICY IF EXISTS "Users can view participants for their expenses" ON expense_participants;
DROP POLICY IF EXISTS "Users can view their own participation" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can delete participants" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can insert participants" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can update participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can delete their own participation" ON expense_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON expense_participants;

-- Create new policies that avoid recursion
-- Policy for SELECT: Users can view participants if they created the expense OR if they are a participant
CREATE POLICY "Users can view expense participants"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User created the shared expense (direct check without subquery)
    EXISTS (
      SELECT 1 FROM shared_expenses 
      WHERE shared_expenses.id = expense_participants.shared_expense_id 
      AND shared_expenses.created_by = auth.uid()
    )
    OR 
    -- User is the participant (direct email check)
    expense_participants.user_email = auth.email()
  );

-- Policy for INSERT: Only expense creators can add participants
CREATE POLICY "Expense creators can add participants"
  ON expense_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses 
      WHERE shared_expenses.id = expense_participants.shared_expense_id 
      AND shared_expenses.created_by = auth.uid()
    )
  );

-- Policy for UPDATE: Expense creators can update any participant, users can update their own records
CREATE POLICY "Users can update expense participants"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (
    -- User created the shared expense
    EXISTS (
      SELECT 1 FROM shared_expenses 
      WHERE shared_expenses.id = expense_participants.shared_expense_id 
      AND shared_expenses.created_by = auth.uid()
    )
    OR 
    -- User is updating their own participation
    expense_participants.user_email = auth.email()
  )
  WITH CHECK (
    -- Same conditions for the updated record
    EXISTS (
      SELECT 1 FROM shared_expenses 
      WHERE shared_expenses.id = expense_participants.shared_expense_id 
      AND shared_expenses.created_by = auth.uid()
    )
    OR 
    expense_participants.user_email = auth.email()
  );

-- Policy for DELETE: Expense creators can delete any participant, users can delete their own records
CREATE POLICY "Users can delete expense participants"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (
    -- User created the shared expense
    EXISTS (
      SELECT 1 FROM shared_expenses 
      WHERE shared_expenses.id = expense_participants.shared_expense_id 
      AND shared_expenses.created_by = auth.uid()
    )
    OR 
    -- User is deleting their own participation
    expense_participants.user_email = auth.email()
  );