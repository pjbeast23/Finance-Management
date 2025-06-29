/*
  # Fix Group Expenses Creator Relationship

  1. New Tables
    - `users` table to mirror auth.users for proper foreign key relationships
  
  2. Data Migration
    - Populate users table with existing auth.users data
  
  3. Foreign Key Updates
    - Update all foreign key constraints to reference the new users table
  
  4. Security
    - Enable RLS on users table
    - Add policies for user data access
    - Create trigger for automatic user creation
*/

-- Create users table if it doesn't exist (mirrors auth.users for relationships)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Insert existing auth users into users table FIRST (before updating constraints)
INSERT INTO users (id, email, created_at)
SELECT id, email, created_at 
FROM auth.users 
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  updated_at = now();

-- Create policies for users table
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Users can insert own data" ON users;
  
  -- Create new policies
  CREATE POLICY "Users can read own data" ON users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

  CREATE POLICY "Users can update own data" ON users
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "Users can insert own data" ON users
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);
END $$;

-- Function to handle user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Now update foreign key constraints (after users table is populated)

-- Update foreign key constraints for groups
ALTER TABLE groups 
DROP CONSTRAINT IF EXISTS groups_created_by_fkey;

ALTER TABLE groups 
ADD CONSTRAINT groups_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for group_expenses
ALTER TABLE group_expenses 
DROP CONSTRAINT IF EXISTS group_expenses_created_by_fkey;

ALTER TABLE group_expenses 
ADD CONSTRAINT group_expenses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for group_investments  
ALTER TABLE group_investments 
DROP CONSTRAINT IF EXISTS group_investments_created_by_fkey;

ALTER TABLE group_investments 
ADD CONSTRAINT group_investments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for expenses
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;

ALTER TABLE expenses 
ADD CONSTRAINT expenses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for investments
ALTER TABLE investments 
DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

ALTER TABLE investments 
ADD CONSTRAINT investments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for bill_splits
ALTER TABLE bill_splits 
DROP CONSTRAINT IF EXISTS bill_splits_user_id_fkey;

ALTER TABLE bill_splits 
ADD CONSTRAINT bill_splits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for expense_predictions
ALTER TABLE expense_predictions 
DROP CONSTRAINT IF EXISTS expense_predictions_user_id_fkey;

ALTER TABLE expense_predictions 
ADD CONSTRAINT expense_predictions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for friends
ALTER TABLE friends 
DROP CONSTRAINT IF EXISTS friends_user_id_fkey;

ALTER TABLE friends 
ADD CONSTRAINT friends_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for shared_expenses
ALTER TABLE shared_expenses 
DROP CONSTRAINT IF EXISTS shared_expenses_created_by_fkey;

ALTER TABLE shared_expenses 
ADD CONSTRAINT shared_expenses_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Update foreign key constraints for group_members (invited_by column)
ALTER TABLE group_members 
DROP CONSTRAINT IF EXISTS group_members_invited_by_fkey;

ALTER TABLE group_members 
ADD CONSTRAINT group_members_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES users(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);