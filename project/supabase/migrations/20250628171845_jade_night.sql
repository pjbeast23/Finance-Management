/*
  # Create bill_splits table

  1. New Tables
    - `bill_splits`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, foreign key to auth.users, not null)
      - `title` (text, not null)
      - `total_amount` (numeric, not null)
      - `participants` (text[], not null)
      - `split_method` (text, not null)
      - `split_data` (jsonb, not null)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `bill_splits` table
    - Add policies for authenticated users to manage their own bill splits

  3. Constraints
    - Check that total_amount is positive
    - Check that split_method is one of: 'equal', 'percentage', 'custom'
    - Check that participants array is not empty
*/

CREATE TABLE IF NOT EXISTS bill_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  participants text[] NOT NULL CHECK (array_length(participants, 1) >= 2),
  split_method text NOT NULL CHECK (split_method IN ('equal', 'percentage', 'custom')),
  split_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;

-- Create policies for bill_splits table
CREATE POLICY "Users can view their own bill splits"
  ON bill_splits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bill splits"
  ON bill_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill splits"
  ON bill_splits
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill splits"
  ON bill_splits
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS bill_splits_user_id_idx ON bill_splits(user_id);
CREATE INDEX IF NOT EXISTS bill_splits_created_at_idx ON bill_splits(created_at);