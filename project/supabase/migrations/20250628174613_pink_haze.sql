/*
  # Create investments tracking tables

  1. New Tables
    - `investments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `symbol` (text, stock/asset symbol)
      - `name` (text, investment name)
      - `quantity` (numeric, number of shares/units)
      - `purchase_price` (numeric, price per share when purchased)
      - `current_price` (numeric, current market price)
      - `purchase_date` (timestamptz, when investment was made)
      - `investment_type` (text, type of investment)
      - `notes` (text, optional notes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `investment_transactions`
      - `id` (uuid, primary key)
      - `investment_id` (uuid, references investments)
      - `transaction_type` (text, buy/sell)
      - `quantity` (numeric, number of shares)
      - `price_per_share` (numeric, price per share)
      - `total_amount` (numeric, total transaction amount)
      - `transaction_date` (timestamptz, when transaction occurred)
      - `fees` (numeric, transaction fees)
      - `notes` (text, optional notes)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
    - Users can only access their own investments and transactions

  3. Indexes
    - Performance indexes on user_id, symbol, type, and dates
*/

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