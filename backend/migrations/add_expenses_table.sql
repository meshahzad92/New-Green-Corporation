"""
Database Migration Script for Expenses Table
This script adds the expenses table for tracking daily expenses and income
"""

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,  -- Can be negative (expense) or positive (income/gift)
    quantity INTEGER DEFAULT 1,
    details TEXT,
    expense_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_is_deleted ON expenses(is_deleted);
CREATE INDEX IF NOT EXISTS idx_expenses_date_not_deleted ON expenses(expense_date, is_deleted);

-- Add comments for documentation
COMMENT ON TABLE expenses IS 'Tracks daily expenses and income for the business';
COMMENT ON COLUMN expenses.amount IS 'Amount - negative for expenses, positive for income/gifts';
COMMENT ON COLUMN expenses.expense_date IS 'Date when the expense occurred';
COMMENT ON COLUMN expenses.is_deleted IS 'Soft delete flag - marks record as deleted without removing from database';
COMMENT ON COLUMN expenses.deleted_at IS 'Timestamp when record was soft deleted';
