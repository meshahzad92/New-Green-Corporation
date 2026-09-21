#!/bin/sh
set -e

echo "========================================================"
echo "🚀 Starting AgriManage Pro Backend Container on AWS"
echo "========================================================"

# Step 1: Initialize Database (creates tables, seeds default user and companies if needed)
echo "🔧 Checking and initializing database..."
python init_db.py || echo "⚠️ Database initialization notice (continuing)..."

# Step 2: Start FastAPI server with Uvicorn
echo "🌐 Starting FastAPI server on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
