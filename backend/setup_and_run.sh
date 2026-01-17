#!/bin/bash
# Complete setup and verification script for AgriManage Pro Backend

echo "🚀 AgriManage Pro - Complete Setup & Verification"
echo "=================================================="
echo ""

# Step 1: Apply database migration
echo "📊 Step 1: Applying database migration..."
python apply_migration.py
if [ $? -ne 0 ]; then
    echo "❌ Migration failed! Please check your database connection."
    exit 1
fi
echo "✅ Migration completed"
echo ""

# Step 2: Initialize database
echo "📊 Step 2: Initializing database (creating tables and default user)..."
python init_db.py
if [ $? -ne 0 ]; then
    echo "❌ Database initialization failed!"
    exit 1
fi
echo "✅ Database initialized"
echo ""

# Step 3: Install test dependencies
echo "🧪 Step 3: Installing test dependencies..."
pip install -q -r tests/requirements.txt
echo "✅ Test dependencies installed"
echo ""

# Step 4: Run tests
echo "🧪 Step 4: Running test suite..."
pytest tests/ -v --tb=short
TEST_RESULT=$?
echo ""

if [ $TEST_RESULT -eq 0  ]; then
    echo "✅ All tests passed!"
else
    echo "⚠️  Some tests failed. Review the output above."
fi
echo ""

# Step 5: Start the server
echo "🌐 Step 5: Starting FastAPI server..."
echo "📍 Server will be available at: http://localhost:8000"
echo "📖 API Documentation at: http://localhost:8000/docs"
echo ""
echo "Press CTRL+C to stop the server"
echo ""

python main.py
