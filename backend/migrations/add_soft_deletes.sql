"""
Database Migration Script for Soft Deletes
This script adds is_deleted and deleted_at columns to sales and stock_transactions tables
for maintaining complete historical logs.

Run this manually using psql or your PostgreSQL client:
"""

-- Add soft delete columns to stock_transactions table
ALTER TABLE stock_transactions 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE stock_transactions 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add soft delete columns to sales table  
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_transactions_is_deleted ON stock_transactions(is_deleted);
CREATE INDEX IF NOT EXISTS idx_sales_is_deleted ON sales(is_deleted);

-- Add comments for documentation
COMMENT ON COLUMN stock_transactions.is_deleted IS 'Soft delete flag - marks record as deleted without removing from database';
COMMENT ON COLUMN stock_transactions.deleted_at IS 'Timestamp when record was soft deleted';
COMMENT ON COLUMN sales.is_deleted IS 'Soft delete flag - marks record as deleted without removing from database';
COMMENT ON COLUMN sales.deleted_at IS 'Timestamp when record was soft deleted';
