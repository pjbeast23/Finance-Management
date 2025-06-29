/*
  # Create Groups Functionality

  1. New Tables
    - `groups` - Store group information (name, description, created by)
    - `group_members` - Store group membership with roles
    - `group_expenses` - Store expenses shared within groups
    - `group_investments` - Store investments shared within groups

  2. Security
    - Enable RLS on all new tables
    - Add policies for group access control
    - Members can only access groups they belong to

  3. Features
    - Multiple groups per user
    - Role-based access (admin, member)
    - Shared expenses and investments per group
    - Group-specific dashboards
*/

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_type text NOT NULL DEFAULT 'family',
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT groups_type_check CHECK (group_type IN ('family', 'friends', 'roommates', 'team', 'other'))
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  user_name text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES auth.users(id),
  CONSTRAINT group_members_role_check CHECK (role IN ('admin', 'member')),
  CONSTRAINT group_members_status_check CHECK (status IN ('active', 'inactive', 'pending')),
  UNIQUE(group_id, user_email)
);

-- Create group_expenses table
CREATE TABLE IF NOT EXISTS group_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  description text,
  date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT group_expenses_amount_check CHECK (amount >= 0)
);

-- Create group_investments table
CREATE TABLE IF NOT EXISTS group_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
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
  CONSTRAINT group_investments_quantity_check CHECK (quantity >= 0),
  CONSTRAINT group_investments_purchase_price_check CHECK (purchase_price > 0),
  CONSTRAINT group_investments_current_price_check CHECK (current_price >= 0),
  CONSTRAINT group_investments_type_check CHECK (investment_type IN ('stock', 'bond', 'crypto', 'etf', 'mutual_fund', 'other'))
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_investments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS groups_created_by_idx ON groups(created_by);
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_email_idx ON group_members(user_email);
CREATE INDEX IF NOT EXISTS group_expenses_group_id_idx ON group_expenses(group_id);
CREATE INDEX IF NOT EXISTS group_expenses_date_idx ON group_expenses(date);
CREATE INDEX IF NOT EXISTS group_investments_group_id_idx ON group_investments(group_id);
CREATE INDEX IF NOT EXISTS group_investments_symbol_idx ON group_investments(symbol);

-- RLS Policies for groups
CREATE POLICY "Users can view groups they created or are members of"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = groups.id 
      AND gm.user_email = auth.email()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Users can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update groups"
  ON groups
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = groups.id 
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Group creators can delete groups"
  ON groups
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for group_members
CREATE POLICY "Users can view members of their groups"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND (
        g.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM group_members gm2 
          WHERE gm2.group_id = g.id 
          AND gm2.user_email = auth.email()
          AND gm2.status = 'active'
        )
      )
    )
  );

CREATE POLICY "Group admins can manage members"
  ON group_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND (
        g.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM group_members gm 
          WHERE gm.group_id = g.id 
          AND gm.user_email = auth.email()
          AND gm.role = 'admin'
          AND gm.status = 'active'
        )
      )
    )
  );

-- RLS Policies for group_expenses
CREATE POLICY "Group members can view group expenses"
  ON group_expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_expenses.group_id 
      AND gm.user_email = auth.email()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Group members can create group expenses"
  ON group_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_expenses.group_id 
      AND gm.user_email = auth.email()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Expense creators and admins can update group expenses"
  ON group_expenses
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_expenses.group_id 
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Expense creators and admins can delete group expenses"
  ON group_expenses
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_expenses.group_id 
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );

-- RLS Policies for group_investments
CREATE POLICY "Group members can view group investments"
  ON group_investments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_investments.group_id 
      AND gm.user_email = auth.email()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Group members can create group investments"
  ON group_investments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_investments.group_id 
      AND gm.user_email = auth.email()
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Investment creators and admins can update group investments"
  ON group_investments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_investments.group_id 
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );

CREATE POLICY "Investment creators and admins can delete group investments"
  ON group_investments
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = group_investments.group_id 
      AND gm.user_email = auth.email()
      AND gm.role = 'admin'
      AND gm.status = 'active'
    )
  );