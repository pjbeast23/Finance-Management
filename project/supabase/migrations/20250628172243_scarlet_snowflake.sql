/*
  # Enhanced Finance Tracker - Friends and Shared Expenses

  1. New Tables
    - `friends` - User friendship relationships
    - `shared_expenses` - Expenses shared between users
    - `expense_participants` - Individual participant shares in shared expenses
    - `settlements` - Track payments between users

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their data
    - Ensure users can only see their own friends and shared expenses

  3. Features
    - Friend management system
    - Shared expense tracking
    - Settlement calculations
    - Expense splitting with multiple methods
*/

-- Create friends table for managing user relationships
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_email text NOT NULL,
  friend_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create shared_expenses table for expenses shared between users
CREATE TABLE IF NOT EXISTS shared_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  category text NOT NULL,
  date timestamptz NOT NULL,
  split_method text NOT NULL DEFAULT 'equal' CHECK (split_method IN ('equal', 'percentage', 'custom', 'shares')),
  currency text DEFAULT 'USD',
  receipt_url text,
  is_settled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create expense_participants table for tracking individual shares
CREATE TABLE IF NOT EXISTS expense_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_expense_id uuid NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_name text NOT NULL,
  amount_owed numeric NOT NULL CHECK (amount_owed >= 0),
  amount_paid numeric DEFAULT 0 CHECK (amount_paid >= 0),
  percentage numeric CHECK (percentage >= 0 AND percentage <= 100),
  shares integer CHECK (shares > 0),
  is_settled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create settlements table for tracking payments between users
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_email text NOT NULL,
  to_user_email text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  shared_expense_id uuid REFERENCES shared_expenses(id) ON DELETE CASCADE,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create expense_predictions table for storing ML predictions
CREATE TABLE IF NOT EXISTS expense_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_date date NOT NULL,
  predicted_amount numeric NOT NULL,
  category text,
  confidence_score numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  prediction_type text NOT NULL CHECK (prediction_type IN ('daily', 'weekly', 'monthly', 'category')),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS friends_user_id_idx ON friends(user_id);
CREATE INDEX IF NOT EXISTS friends_friend_email_idx ON friends(friend_email);
CREATE INDEX IF NOT EXISTS friends_status_idx ON friends(status);

CREATE INDEX IF NOT EXISTS shared_expenses_created_by_idx ON shared_expenses(created_by);
CREATE INDEX IF NOT EXISTS shared_expenses_date_idx ON shared_expenses(date);
CREATE INDEX IF NOT EXISTS shared_expenses_category_idx ON shared_expenses(category);
CREATE INDEX IF NOT EXISTS shared_expenses_is_settled_idx ON shared_expenses(is_settled);

CREATE INDEX IF NOT EXISTS expense_participants_shared_expense_id_idx ON expense_participants(shared_expense_id);
CREATE INDEX IF NOT EXISTS expense_participants_user_email_idx ON expense_participants(user_email);
CREATE INDEX IF NOT EXISTS expense_participants_is_settled_idx ON expense_participants(is_settled);

CREATE INDEX IF NOT EXISTS settlements_from_user_email_idx ON settlements(from_user_email);
CREATE INDEX IF NOT EXISTS settlements_to_user_email_idx ON settlements(to_user_email);
CREATE INDEX IF NOT EXISTS settlements_status_idx ON settlements(status);

CREATE INDEX IF NOT EXISTS expense_predictions_user_id_idx ON expense_predictions(user_id);
CREATE INDEX IF NOT EXISTS expense_predictions_date_idx ON expense_predictions(prediction_date);
CREATE INDEX IF NOT EXISTS expense_predictions_type_idx ON expense_predictions(prediction_type);

-- Enable Row Level Security
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_predictions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friends table
CREATE POLICY "Users can view their own friends"
  ON friends
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own friends"
  ON friends
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friends"
  ON friends
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friends"
  ON friends
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for shared_expenses table
CREATE POLICY "Users can view shared expenses they created or participate in"
  ON shared_expenses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM expense_participants ep
      WHERE ep.shared_expense_id = shared_expenses.id
      AND ep.user_email = auth.email()
    )
  );

CREATE POLICY "Users can insert their own shared expenses"
  ON shared_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update shared expenses they created"
  ON shared_expenses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete shared expenses they created"
  ON shared_expenses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create RLS policies for expense_participants table
CREATE POLICY "Users can view participants in their shared expenses"
  ON expense_participants
  FOR SELECT
  TO authenticated
  USING (
    user_email = auth.email() OR
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = expense_participants.shared_expense_id
      AND se.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert participants in their shared expenses"
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

CREATE POLICY "Users can update participants in their shared expenses"
  ON expense_participants
  FOR UPDATE
  TO authenticated
  USING (
    user_email = auth.email() OR
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = expense_participants.shared_expense_id
      AND se.created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_email = auth.email() OR
    EXISTS (
      SELECT 1 FROM shared_expenses se
      WHERE se.id = expense_participants.shared_expense_id
      AND se.created_by = auth.uid()
    )
  );

-- Create RLS policies for settlements table
CREATE POLICY "Users can view settlements they are involved in"
  ON settlements
  FOR SELECT
  TO authenticated
  USING (from_user_email = auth.email() OR to_user_email = auth.email());

CREATE POLICY "Users can insert settlements they are involved in"
  ON settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (from_user_email = auth.email() OR to_user_email = auth.email());

CREATE POLICY "Users can update settlements they are involved in"
  ON settlements
  FOR UPDATE
  TO authenticated
  USING (from_user_email = auth.email() OR to_user_email = auth.email())
  WITH CHECK (from_user_email = auth.email() OR to_user_email = auth.email());

-- Create RLS policies for expense_predictions table
CREATE POLICY "Users can view their own predictions"
  ON expense_predictions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
  ON expense_predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions"
  ON expense_predictions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own predictions"
  ON expense_predictions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to calculate user balances
CREATE OR REPLACE FUNCTION calculate_user_balance(user_email_param text)
RETURNS TABLE (
  friend_email text,
  friend_name text,
  balance numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH user_owes AS (
    SELECT 
      ep.user_email as friend_email,
      ep.user_name as friend_name,
      -SUM(ep.amount_owed - ep.amount_paid) as amount
    FROM expense_participants ep
    JOIN shared_expenses se ON ep.shared_expense_id = se.id
    WHERE se.created_by = (SELECT auth.uid() FROM auth.users WHERE email = user_email_param)
    AND ep.user_email != user_email_param
    AND NOT ep.is_settled
    GROUP BY ep.user_email, ep.user_name
  ),
  user_is_owed AS (
    SELECT 
      (SELECT email FROM auth.users WHERE id = se.created_by) as friend_email,
      (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = se.created_by) as friend_name,
      SUM(ep.amount_owed - ep.amount_paid) as amount
    FROM expense_participants ep
    JOIN shared_expenses se ON ep.shared_expense_id = se.id
    WHERE ep.user_email = user_email_param
    AND NOT ep.is_settled
    GROUP BY se.created_by
  )
  SELECT 
    COALESCE(uo.friend_email, uio.friend_email) as friend_email,
    COALESCE(uo.friend_name, uio.friend_name) as friend_name,
    COALESCE(uo.amount, 0) + COALESCE(uio.amount, 0) as balance
  FROM user_owes uo
  FULL OUTER JOIN user_is_owed uio ON uo.friend_email = uio.friend_email
  WHERE COALESCE(uo.amount, 0) + COALESCE(uio.amount, 0) != 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;