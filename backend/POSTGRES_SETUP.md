# PostgreSQL Production Setup on AWS EC2

## 🚀 Quick Deployment

### 1. Generate Secure Credentials

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate PostgreSQL password
openssl rand -base64 24
```

### 2. Create .env file on EC2

```bash
ssh -i GreenCorportion.pem ubuntu@18.216.254.232

cd ~/New-Green-Corporation/backend

# Create .env from template
cp .env.example .env

# Edit with your secure values
nano .env
```

Update these values:
```bash
DATABASE_URL=postgresql://agrimanage:YOUR_SECURE_PASSWORD@postgres:5432/agrimanage_db
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
SECRET_KEY=YOUR_GENERATED_SECRET_KEY
```

### 3. Deploy with PostgreSQL

```bash
# Pull latest code
git pull origin main

# Stop old containers
docker-compose down -v

# Start PostgreSQL + Backend
docker-compose up -d

# Wait for PostgreSQL to be ready
sleep 20

# Initialize database
docker exec -it agrimanage-backend python init_db.py

# Verify
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/companies/
```

### 4. Create Admin User

```bash
docker exec -i agrimanage-backend python << 'EOF'
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()

user = User(
    email="waris92",
    hashed_password=get_password_hash("waris92"),
    full_name="Waris Admin",
    is_active=True
)
db.add(user)
db.commit()
print("✅ User created: waris92 / waris92")
db.close()
EOF
```

## 📊 Verify PostgreSQL

```bash
# Check PostgreSQL is running
docker exec -it agrimanage-postgres psql -U agrimanage -d agrimanage_db -c "\dt"

# Check tables
docker exec -it agrimanage-postgres psql -U agrimanage -d agrimanage_db -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"

# Check companies
docker exec -it agrimanage-postgres psql -U agrimanage -d agrimanage_db -c "SELECT name FROM companies;"
```

## 🔒 Security Checklist

- [ ] Changed `SECRET_KEY` to random 64-character hex
- [ ] Changed `POSTGRES_PASSWORD` to strong password  
- [ ] Verified `.env` is in `.gitignore`
- [ ] Updated Vercel `VITE_API_URL` to EC2 IP
- [ ] Tested login with waris92 credentials

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `POSTGRES_USER` | PostgreSQL username | `agrimanage` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `secure_password_here` |
| `POSTGRES_DB` | Database name | `agrimanage_db` |
| `SECRET_KEY` | JWT signing key | `openssl rand -hex 32` output |

## 🔄 Backup & Restore

### Backup
```bash
docker exec agrimanage-postgres pg_dump -U agrimanage agrimanage_db > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i agrimanage-postgres psql -U agrimanage agrimanage_db
```

## ✅ Done!

Your application now runs with PostgreSQL instead of SQLite!
