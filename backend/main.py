#!/usr/bin/env python3
"""
AgriManage Pro Backend Startup Script
Run this file to start the backend server: python main.py
Options:
  --init-db    Force database initialization (tables creation and demo user)
  --skip-db    Skip database initialization check
"""
import os
import sys
import uvicorn

# Add the project root to the path
sys.path.insert(0, os.path.dirname(__file__))

def check_database_initialized():
    """Check if database tables already exist (5 second timeout)"""
    try:
        from app.db.session import engine
        from sqlalchemy import inspect, create_engine, text

        # Build a temporary engine with a short connect timeout so we never hang
        connect_args = {"connect_timeout": 5}
        if str(engine.url).startswith("postgresql"):
            connect_args["sslmode"] = "require"
        temp_engine = create_engine(
            engine.url,
            connect_args=connect_args,
            pool_pre_ping=False
        )
        inspector = inspect(temp_engine)
        tables = inspector.get_table_names()
        temp_engine.dispose()
        return len(tables) > 0
    except KeyboardInterrupt:
        # User pressed Ctrl+C during the DB check — skip the check and start server
        print("\n⏭️  DB check interrupted — skipping (server will start normally)")
        return True   # Treat as "already initialized" so we don't try init_db either
    except Exception as e:
        print(f"⚠️  DB check skipped (connection issue): {e}")
        return None

def main():
    """Main entry point for the backend application"""
    print("=" * 60)
    print("🚀 Starting AgriManage Pro Backend Server")
    print("=" * 60)
    
    # Parse command line arguments
    force_init = "--init-db" in sys.argv
    skip_init = "--skip-db" in sys.argv
    
    # Initialize the database if needed
    if not skip_init:
        db_exists = check_database_initialized()
        
        if force_init or db_exists is False:
            print("\n📊 Initializing database...")
            try:
                from init_db import init_db
                init_db()
                print("✅ Database initialized successfully")
            except Exception as e:
                print(f"⚠️  Database initialization warning: {e}")
                print("Continuing to start server...")
        elif db_exists is True:
            print("\n✅ Database already initialized (use --init-db to force)")
        else:
            print("\n⚠️  Could not verify database (connection issue). Skipping auto-initialization.")
    else:
        print("\n⏭️  Skipping database initialization")
    
    # Start the FastAPI server with uvicorn
    print("\n🌐 Starting FastAPI server...")
    print("📍 API will be available at: http://localhost:8000")
    print("📖 API Documentation at: http://localhost:8000/docs")
    print("=" * 60)
    print("\nPress CTRL+C to stop the server\n")
    
    # Run uvicorn server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )

if __name__ == "__main__":
    main()
