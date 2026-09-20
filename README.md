# AgriManage Pro

Professional Agricultural Inventory Management System

## Production Hosting

| Service | Platform | URL |
|---|---|---|
| **Frontend** | Vercel | https://new-green-corporation.vercel.app |
| **Backend API** | Render (free tier) | https://agrimanage-backend.onrender.com |
| **Database** | Supabase (PostgreSQL) | Managed cloud DB |

## Local Development

### Backend
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
python main.py --init-db
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Local Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Login**: waris92 / waris92

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SECRET_KEY=<your-secret-key>
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Frontend (Vercel dashboard)
```
VITE_API_URL=https://agrimanage-backend.onrender.com/api/v1
```

## Testing

```bash
cd backend
python tests/verify_api.py
```

## Features

✅ Complete inventory management  
✅ Stock tracking with soft delete (historical logs)  
✅ Sales management (Credit/Debit)  
✅ Multi-company support  
✅ Dashboard with statistics  
✅ Dark mode support  
✅ Mobile responsive  

## Tech Stack

- **Backend**: FastAPI, PostgreSQL (Supabase), SQLAlchemy
- **Frontend**: React, TypeScript, Vite
- **Hosting**: Vercel (frontend) + Render (backend) + Supabase (DB)

## GitHub Actions

| Workflow | Schedule | Purpose |
|---|---|---|
| `keep-alive.yml` | Every 10 minutes | Pings Render to prevent cold starts |
| `backup-db.yml` | Every Sunday 2am PKT | Backs up Supabase DB to Google Drive |

## GitHub Secrets Required

Add these under **Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `SUPABASE_DB_PASSWORD` | Supabase PostgreSQL password |
| `SUPABASE_PROJECT_REF` | Supabase project reference ID |
| `GDRIVE_CREDENTIALS` | Google service account JSON (base64 encoded) |
| `GDRIVE_FOLDER_ID` | Google Drive folder ID for backups |

## Status

✅ Production Ready — Fully free hosting stack (Vercel + Render + Supabase)
