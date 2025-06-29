/*
  # Add group association to shared expenses

  1. Changes
    - Add optional group_id column to shared_expenses table
    - Add foreign key constraint to groups table
    - Add index for better performance
    - Update RLS policies to handle group-based shared expenses

  2. Security
    - Maintain existing RLS policies
    - Ensure group members can view group-associated shared expenses
*/

-- Add group_id column to shared_expenses table
ALTER TABLE shared_expenses 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS shared_expenses_group_id_idx ON shared_expenses(group_id);

-- Update RLS policies to handle group-based shared expenses
-- Users can view shared expenses they created, participate in, OR are group members of
DROP POLICY IF EXISTS "Users can view their shared expenses" ON shared_expenses;

CREATE POLICY "Users can view their shared expenses"
  ON shared_expenses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM expense_participants ep 
      WHERE ep.shared_expense_id = shared_expenses.id 
      AND ep.user_email = auth.email()
    ) OR
    (
      group_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM group_members gm 
        WHERE gm.group_id = shared_expenses.group_id 
        AND gm.user_email = auth.email() 
        AND gm.status = 'active'
      )
    )
  );