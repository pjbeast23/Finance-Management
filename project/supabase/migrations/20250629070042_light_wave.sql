/*
  # Fix infinite recursion in expense_participants RLS policies

  1. Problem
    - The current RLS policies on expense_participants table are causing infinite recursion
    - This happens when joining shared_expenses with expense_participants
    - The policies are creating circular dependencies during evaluation

  2. Solution
    - Drop existing problematic policies
    - Create new, simpler policies that avoid recursion
    - Use direct user authentication checks instead of complex joins

  3. New Policies
    - Users can view participants for expenses they created (using auth.uid())
    - Users can view their own participant records (using auth.email())
    - Expense creators can manage participants (using auth.uid())
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Expense creators can view all participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can view their own participant records" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can delete participants" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can insert participants" ON expense_participants;
DROP POLICY IF EXISTS "Expense creators can update participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can delete their own participant records" ON expense_participants;
DROP POLICY IF EXISTS "Users can update their own participant records" ON expense_participants;

-- Create new, non-recursive policies
CREATE POLICY "Users can view participants for their expenses"
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

CREATE POLICY "Users can view their own participation"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

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

CREATE POLICY "Users can update their own participation"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Users can delete their own participation"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());