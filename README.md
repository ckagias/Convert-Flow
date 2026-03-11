# ConvertFlow

A production-ready, **secure file converter** inspired by iLovePDF-style workflows.

- Authenticated users can upload files and convert between multiple formats.
- Frontend includes a **“Convert .X to .Y” selector** so you choose the target type *before* uploading.
- Backend runs conversions in background jobs and keeps each user’s files fully isolated.

Built with **FastAPI + React (Vite) + Tailwind CSS + SQLite + Docker**.

---

## Project Structure

```
convertflow/
├── docker-compose.yml          # Orchestrates backend + frontend containers
│
├── backend/
│   ├── Dockerfile              # Python 3.11-slim image (+ poppler-utils)
│   ├── requirements.txt        # FastAPI, SQLAlchemy, pdf2docx, Pillow, pdf2image, etc.
│   ├── main.py                 # FastAPI app — auth, files, formats API
│   ├── models.py               # SQLAlchemy ORM models
│   └── converters.py           # Central conversion router (handle_conversion)
│
└── frontend/
    ├── Dockerfile              # Multi-stage: Vite build → Nginx serve
    ├── nginx.conf              # Reverse proxy + SPA routing
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js      # Typography, color palette, animations
    ├── postcss.config.js
    ├── index.html              # Root HTML + font includes
    └── src/
        ├── App.jsx             # Auth wrapper, sets axios baseURL + JWT header
        ├── main.jsx            # React bootstrap
        ├── index.css           # Tailwind layers + custom utility classes
        └── components/
            ├── AuthPage.jsx        # Login / Register UI
            └── FileConverter.jsx   # Main app (selector, upload, list, notes)
```

---

## Quick Start — Docker

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

### 1. Clone / create the project

```bash
# If you received this as a zip, just unzip it:
unzip convertflow.zip
cd convertflow
```

### 2. (Optional) Set a strong secret key

Edit `docker-compose.yml` and change:
```yaml
- SECRET_KEY=change-this-in-production-use-a-long-random-string
```
To something like:
```bash
# Generate a random key:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Build and start

```bash
docker compose up --build
```

The first build takes **3–5 minutes** (downloads Python + Node images, installs deps).
Subsequent starts are near-instant.

### 4. Open the app

| Service   | URL                      |
|-----------|--------------------------|
| Frontend  | http://localhost:3000    |
| API docs  | http://localhost:8000/docs |
| Health    | http://localhost:8000/health |

### 5. Stop

```bash
docker compose down
```

To also remove all stored files and the database:
```bash
docker compose down -v
```

---

## Local Development (no Docker)

### Backend

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create runtime directories (or use your own paths via env vars)
mkdir -p uploads outputs db

# Start dev server (uses SQLite by default)
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (configure API URL via VITE_API_URL if needed)
npm run dev
# → http://localhost:5173
```

---

## Security Design

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | JWT (HS256), 24-hour expiry via `python-jose` |
| **Password storage** | bcrypt via `passlib` — salted + slow hash |
| **File isolation** | Every stored filename is prefixed with the user's UUID `session_id`; no two users share a namespace |
| **IDOR protection** | Every file/comment endpoint filters `WHERE user_id = current_user.id` |
| **File type validation** | Extension whitelist (pdf, docx, pptx, xlsx, jpg, jpeg, png) + 50 MB size limit |
| **Path traversal** | Original filenames are never used on disk; UUID-prefixed names are generated server-side |
| **Audit log** | `security_logs` table records LOGIN, FAILED_LOGIN, REGISTER, UPLOAD events with IP |

---

## Supported Conversions

All conversions are routed through `backend/converters.py:handle_conversion` and validated
against a central `SUPPORTED_CONVERSIONS` map to avoid unsafe combinations.

**Current matrix:**

| Input | Output(s)       | Libraries / Notes |
|-------|-----------------|-------------------|
| PDF   | DOCX            | `pdf2docx` — reconstructs layout, tables, images |
| PDF   | JPG / PNG / ZIP | `pdf2image` + `Pillow` — one image per page, ZIP for multi-page |
| DOCX  | PDF             | `python-docx` + `PyPDF2` (simple text-only export) |
| PPTX  | PDF             | `python-pptx` + `PyPDF2` (basic slide export) |
| PPTX  | JPG / PNG / ZIP | via `pptx_to_pdf` + `pdf2image` + `Pillow` |
| XLSX  | PDF             | `openpyxl` (validation) + `PyPDF2` (simple export) |
| JPG / JPEG / PNG | PDF | `Pillow` — rasterized single-page PDF |
| JPG / JPEG / PNG | JPG / PNG | `Pillow` — image→image conversion |

Some PDF operations (merge, split, rotate, protect) are partially scaffolded
with `PyPDF2` and `borb` and can be extended further.

---

## API Reference

Full interactive docs: **http://localhost:8000/docs**

```
POST   /auth/register              Register + get JWT
POST   /auth/token                 Login (OAuth2 form) + get JWT
GET    /auth/me                    Current user info

GET    /health                     Simple health probe

GET    /formats                    Supported source→target conversions

POST   /files/upload               Upload a file (with ?target_format=ext)
GET    /files                      List user's files
GET    /files/{id}/status          Poll conversion status
GET    /files/{id}/download        Download converted file
DELETE /files/{id}                 Delete file + disk cleanup

POST   /files/{id}/comments        Add a note to a file
DELETE /files/{id}/comments/{cid}  Delete a note
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `dev-secret-change-me` | JWT signing key — **must** be changed in production |
| `DATABASE_URL` | `sqlite:////app/db/convertflow.db` | SQLAlchemy connection string |
| `ENVIRONMENT` | `production` | Set to `development` for verbose logging |
