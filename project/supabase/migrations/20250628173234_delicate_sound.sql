/*
  # Add unique constraint to expense_predictions table

  1. Changes
    - Add unique constraint on (user_id, prediction_date, prediction_type, category) columns
    - This allows upsert operations to work correctly by identifying existing records

  2. Notes
    - This constraint ensures that each user can only have one prediction per date, type, and category combination
    - Required for the upsert operation in the predictions functionality
*/

-- Add unique constraint to expense_predictions table
ALTER TABLE expense_predictions 
ADD CONSTRAINT expense_predictions_unique_prediction 
UNIQUE (user_id, prediction_date, prediction_type, category);