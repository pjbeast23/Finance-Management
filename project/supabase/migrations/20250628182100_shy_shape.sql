/*
  # Fix investments table creation

  This migration creates the investments and investment_transactions tables with proper RLS policies.
  It handles the case where some policies might already exist by using IF NOT EXISTS where possible
  and DROP/CREATE for policies that don't support IF NOT EXISTS.

  1. New Tables
    - `investments` - stores user investment holdings
    - `investment_transactions` - stores buy/sell transactions for investments
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    
  3. Indexes
    - Add performance indexes for common queries
*/

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  -- Drop investment policies if they exist
  DROP POLICY IF EXISTS "Users can view their own investments" ON investments;
  DROP POLICY IF EXISTS "Users can insert their own investments" ON investments;
  DROP POLICY IF EXISTS "Users can update their own investments" ON investments;
  DROP POLICY IF EXISTS "Users can delete their own investments" ON investments;
  
  -- Drop investment transaction policies if they exist
  DROP POLICY IF EXISTS "Users can view their own investment transactions" ON investment_transactions;
  DROP POLICY IF EXISTS "Users can insert their own investment transactions" ON investment_transactions;
  DROP POLICY IF EXISTS "Users can update their own investment transactions" ON investment_transactions;
  DROP POLICY IF EXISTS "Users can delete their own investment transactions" ON investment_transactions;
EXCEPTION
  WHEN undefined_table THEN
    -- Tables don't exist yet, which is fine
    NULL;
END $$;

-- Create investments table
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL,
  current_price numeric DEFAULT 0,
  purchase_date timestamptz NOT NULL,
  investment_type text NOT NULL DEFAULT 'stock',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT investments_quantity_check CHECK (quantity >= 0),
  CONSTRAINT investments_purchase_price_check CHECK (purchase_price > 0),
  CONSTRAINT investments_current_price_check CHECK (current_price >= 0),
  CONSTRAINT investments_type_check CHECK (investment_type IN ('stock', 'bond', 'crypto', 'etf', 'mutual_fund', 'other'))
);

-- Create investment_transactions table
CREATE TABLE IF NOT EXISTS investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id uuid NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  quantity numeric NOT NULL,
  price_per_share numeric NOT NULL,
  total_amount numeric NOT NULL,
  transaction_date timestamptz NOT NULL,
  fees numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT transactions_quantity_check CHECK (quantity > 0),
  CONSTRAINT transactions_price_check CHECK (price_per_share > 0),
  CONSTRAINT transactions_total_check CHECK (total_amount > 0),
  CONSTRAINT transactions_fees_check CHECK (fees >= 0),
  CONSTRAINT transactions_type_check CHECK (transaction_type IN ('buy', 'sell'))
);

-- Enable RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_transactions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS investments_user_id_idx ON investments(user_id);
CREATE INDEX IF NOT EXISTS investments_symbol_idx ON investments(symbol);
CREATE INDEX IF NOT EXISTS investments_type_idx ON investments(investment_type);
CREATE INDEX IF NOT EXISTS investments_purchase_date_idx ON investments(purchase_date);

CREATE INDEX IF NOT EXISTS transactions_investment_id_idx ON investment_transactions(investment_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON investment_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS transactions_type_idx ON investment_transactions(transaction_type);

-- RLS Policies for investments
CREATE POLICY "Users can view their own investments"
  ON investments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investments"
  ON investments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investments"
  ON investments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investments"
  ON investments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for investment_transactions
CREATE POLICY "Users can view their own investment transactions"
  ON investment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investments i 
      WHERE i.id = investment_transactions.investment_id 
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own investment transactions"
  ON investment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investments i 
      WHERE i.id = investment_transactions.investment_id 
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own investment transactions"
  ON investment_transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investments i 
      WHERE i.id = investment_transactions.investment_id 
      AND i.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investments i 
      WHERE i.id = investment_transactions.investment_id 
      AND i.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own investment transactions"
  ON investment_transactions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM investments i 
      WHERE i.id = investment_transactions.investment_id 
      AND i.user_id = auth.uid()
    )
  );