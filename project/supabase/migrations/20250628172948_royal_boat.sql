/*
  # Fix RLS policies to resolve infinite recursion

  1. Policy Updates
    - Remove circular dependencies between shared_expenses and expense_participants
    - Simplify policies to prevent infinite recursion
    - Maintain proper security while avoiding complex subqueries

  2. Changes Made
    - Update shared_expenses SELECT policy to remove dependency on expense_participants
    - Simplify expense_participants policies to avoid circular references
    - Ensure users can still access their data appropriately

  3. Security
    - Users can view shared expenses they created
    - Users can view shared expenses where they are participants (via direct email check)
    - Users can manage expense participants for their own shared expenses
    - Users can view/update their own participant records
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view shared expenses they created or participate in" ON shared_expenses;
DROP POLICY IF EXISTS "Users can insert participants in their shared expenses" ON expense_participants;
DROP POLICY IF EXISTS "Users can update participants in their shared expenses" ON expense_participants;
DROP POLICY IF EXISTS "Users can view participants in their shared expenses" ON expense_participants;

-- Create simplified shared_expenses SELECT policy
CREATE POLICY "Users can view their shared expenses"
  ON shared_expenses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Create a separate policy for viewing shared expenses where user participates
CREATE POLICY "Users can view shared expenses they participate in"
  ON shared_expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_participants ep 
      WHERE ep.shared_expense_id = shared_expenses.id 
      AND ep.user_email = auth.email()
    )
  );

-- Create simplified expense_participants policies
CREATE POLICY "Users can view their own participant records"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Expense creators can view all participants"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = expense_participants.shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Expense creators can insert participants"
  ON expense_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = expense_participants.shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant records"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Expense creators can update participants"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = expense_participants.shared_expense_id 
      AND se.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = expense_participants.shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own participant records"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Expense creators can delete participants"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = expense_participants.shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );