/*
  # Fix infinite recursion in expense_participants RLS policies

  1. Problem
    - Current RLS policies on expense_participants create circular dependencies
    - Policies reference shared_expenses which references back to expense_participants
    - This causes infinite recursion when querying data

  2. Solution
    - Simplify RLS policies to avoid circular references
    - Use direct email/user checks instead of complex subqueries
    - Maintain security while eliminating recursion

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that don't cause recursion
    - Ensure users can only access their own participant records
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Expense creators can add participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can delete expense participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can update expense participants" ON expense_participants;
DROP POLICY IF EXISTS "Users can view expense participants" ON expense_participants;

-- Create new simplified policies without circular dependencies
CREATE POLICY "Users can view their own participant records"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Users can insert participant records for expenses they created"
  ON expense_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participant records"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (user_email = auth.email())
  WITH CHECK (user_email = auth.email());

CREATE POLICY "Expense creators can update all participant records"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own participant records"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (user_email = auth.email());

CREATE POLICY "Expense creators can delete participant records"
  ON expense_participants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shared_expenses se 
      WHERE se.id = shared_expense_id 
      AND se.created_by = auth.uid()
    )
  );