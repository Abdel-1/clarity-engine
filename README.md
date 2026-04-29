# Clarity Engine — Technical Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Environment Setup](#5-environment-setup)
6. [Running the Project](#6-running-the-project)
7. [Backend — API Reference](#7-backend--api-reference)
8. [Database Schema](#8-database-schema)
9. [AI Analysis Engine](#9-ai-analysis-engine)
10. [Frontend — Pages & Routes](#10-frontend--pages--routes)
11. [Authentication Flow](#11-authentication-flow)
12. [Design System](#12-design-system)
13. [Test Credentials](#13-test-credentials)

---

## 1. Project Overview

**Clarity Engine** is a brand governance SaaS platform built for **Zone Bleue**. It evaluates communication messages against a defined Brand System and returns a structured, AI-powered evaluation.

> It is **not a chatbot**. It is a precision evaluation tool — every output is parsed, structured, and scored.

### What it does
- Accepts a communication message (email, LinkedIn post, press release, etc.)
- Evaluates it against a stored Brand System (brand role, tone, red lines, priorities)
- Returns a **Clarity Score /100**, 5 dimension subscores, a **Narrative Risk** level, and actionable recommendations
- Stores all analyses in a database for history and reporting

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│   React + Vite + TypeScript                         │
│   http://localhost:5173                             │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (fetch)
┌────────────────────▼────────────────────────────────┐
│                    BACKEND                          │
│   FastAPI + Uvicorn                                 │
│   http://127.0.0.1:8000                             │
│                                                     │
│   ┌─────────────┐  ┌──────────────┐                │
│   │  Auth       │  │  Brand       │                │
│   │  /login     │  │  Systems     │                │
│   │  /register  │  │  /api/brand- │                │
│   └─────────────┘  │  systems     │                │
│                    └──────────────┘                │
│   ┌─────────────────────────────────┐              │
│   │  Analysis Engine                │              │
│   │  POST /api/analyze              │              │
│   │    → brand_analysis_service.py  │              │
│   │    → Groq API (LLM)             │              │
│   │    → Save to DB                 │              │
│   └─────────────────────────────────┘              │
└────────────────────┬────────────────────────────────┘
                     │ SQLAlchemy ORM
┌────────────────────▼────────────────────────────────┐
│                  SQLite DATABASE                     │
│   clarity.db                                        │
│   Tables: users, clients, brand_systems, analyses   │
└─────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│               GROQ AI API                           │
│   model: llama-3.3-70b-versatile                    │
│   temperature: 0.1                                  │
│   response_format: json_object                      │
└─────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### Backend
| Component | Technology |
|-----------|-----------|
| Framework | FastAPI |
| Server | Uvicorn |
| ORM | SQLAlchemy |
| Database | SQLite (`clarity.db`) |
| Auth | JWT (python-jose) |
| Password hashing | bcrypt |
| AI | Groq SDK (`llama-3.3-70b-versatile`) |
| Async tasks | Celery + Redis |
| Config | pydantic-settings + `.env` |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | react-router-dom v6 |
| Charts | Recharts |
| Styling | Vanilla CSS (Zone Bleue design system) |
| Fonts | Lora (serif) + DM Sans |

---

## 4. Project Structure

```
clarity-engine/
├── backend/
│   ├── .env                          # Environment variables (not committed)
│   ├── clarity.db                    # SQLite database (auto-created)
│   ├── venv/                         # Python virtual environment
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry, router registration
│   │   ├── core/
│   │   │   ├── config.py             # Settings (loads .env)
│   │   │   ├── security.py           # bcrypt hash/verify
│   │   │   ├── celery_app.py         # Celery configuration
│   │   │   └── dependencies/
│   │   │       └── db.py             # get_db() dependency
│   │   ├── db/
│   │   │   ├── base.py               # SQLAlchemy Base
│   │   │   ├── session.py            # Engine + SessionLocal
│   │   │   └── models/
│   │   │       ├── user.py           # Users table
│   │   │       ├── client.py         # Clients table
│   │   │       ├── brand_system.py   # Brand Systems table
│   │   │       └── analyses.py       # Analyses table
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py           # POST /login, /register
│   │   │       ├── user.py           # User management
│   │   │       ├── brand_systems.py  # Brand system CRUD
│   │   │       ├── analysis.py       # Analyze + history endpoints
│   │   │       ├── upload.py         # File upload (Celery)
│   │   │       └── tasks.py          # GET /tasks/{id} status
│   │   └── services/
│   │       ├── brand_analysis_service.py  # Core AI engine
│   │       ├── groq_provider.py      # Groq SDK wrapper
│   │       ├── ai_service.py         # Legacy document analysis
│   │       ├── user_service.py       # User creation/lookup
│   │       └── tasks.py              # Celery task (process_document)
│   └── scratch_create_technopark.py  # Seed script for Technopark brand
│
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── main.tsx                  # React entry point
        ├── App.tsx                   # Router + protected routes
        ├── index.css                 # Zone Bleue design system
        ├── assets/
        │   └── logo.svg              # Zone Bleue logo
        ├── components/
        │   └── ProtectedRoute.tsx    # Auth guard component
        ├── pages/
        │   ├── Login.tsx             # Login form
        │   ├── Dashboard.tsx         # KPIs + recent analyses
        │   ├── Analyze.tsx           # 3-step analysis wizard
        │   ├── AnalysisResult.tsx    # Full analysis display
        │   ├── BrandSystemNew.tsx    # Create brand system form
        │   ├── BrandSystemEdit.tsx   # Edit brand system form
        │   └── History.tsx           # Filterable analysis history
        └── services/
            ├── auth.ts               # login(), logout(), isLoggedIn()
            ├── api.ts                # uploadDocument()
            ├── brandSystems.ts       # All brand/analysis API calls
            └── tasks.ts              # getTaskStatus()
```

---

## 5. Environment Setup

### Backend `.env` file
Create `backend/.env`:

```env
DATABASE_URL=sqlite:///./clarity.db
SECRET_KEY=your-secret-key-here
GROQ_API_KEY=your-groq-api-key-here
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path (default) or PostgreSQL URL |
| `SECRET_KEY` | JWT signing secret — use a long random string |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |

### Python dependencies
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### Node dependencies
```bash
cd frontend
npm install
```

---

## 6. Running the Project

### Start backend
```bash
cd backend
.\venv\Scripts\uvicorn.exe app.main:app --reload
# → http://127.0.0.1:8000
```

### Start frontend
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

### Start Celery worker (optional — for async document processing)
```bash
cd backend
.\venv\Scripts\celery.exe -A app.core.celery_app.celery worker --loglevel=info --pool=solo
```

> **Note:** Redis must be running for Celery. The brand governance analysis (`/api/analyze`) runs **synchronously** and does **not** require Celery.

### Seed Technopark brand system
```bash
cd backend
.\venv\Scripts\python.exe scratch_create_technopark.py
```

---

## 7. Backend — API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/register` | Create a new user account |
| `POST` | `/login` | Authenticate and receive JWT token |

**POST /login** — Request body:
```json
{ "email": "admin@clarity.com", "password": "Clarity123" }
```
**Response:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

---

### Brand Systems

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/brand-systems` | List all active brand systems |
| `GET` | `/api/brand-systems/{id}` | Get single brand system (all fields) |
| `POST` | `/api/brand-systems` | Create a new brand system |
| `PUT` | `/api/brand-systems/{id}` | Update brand system (version increments) |

**POST /api/brand-systems** — Request body:
```json
{
  "brand_name": "Technopark",
  "brand_role": "Premier hub entrepreneurial au Maroc...",
  "master_statement": "The Impact Hub — Au-delà de l'espace, l'impact.",
  "priorities": "1. Accompagnement entrepreneurial...",
  "territories": "L'innovation à impact...",
  "tone": "Inspirant, Humain, Moderne...",
  "red_lines": "Ne jamais appeler les membres 'Locataires'...",
  "words_preferred": "Innovation, impact, réseau...",
  "words_avoid": "Locataire, bailleur...",
  "audiences": "Startups, investisseurs...",
  "sector": "Technologie, Digital",
  "created_by": "admin"
}
```

---

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Run AI analysis on a message |
| `GET` | `/api/analyses` | List analyses (with filters) |
| `GET` | `/api/analyses/stats` | Dashboard stats |
| `GET` | `/api/analyses/{id}` | Get single analysis with full results |

**POST /api/analyze** — Request body:
```json
{
  "brand_system_id": 1,
  "message_title": "Communiqué de presse Q1 2025",
  "message_body": "Technopark accueille 12 nouvelles startups...",
  "message_language": "fr",
  "channel": "Press Release",
  "audience": "Media",
  "objective": "Awareness",
  "content_type": "Communication",
  "author": "Direction Communication",
  "campaign": "Q1 2025"
}
```

**Response:**
```json
{
  "id": 5,
  "clarity_score": 74,
  "narrative_risk": "Medium"
}
```
→ Redirect to `/analysis/5` to view full results.

**GET /api/analyses** — Query filters:
```
?risk=High&channel=LinkedIn&date_from=2025-01-01&date_to=2025-12-31
```

**GET /api/analyses/stats** — Response:
```json
{
  "total": 24,
  "avg_score": 71.3,
  "risk_distribution": { "Low": 14, "Medium": 8, "High": 2 }
}
```

---

### Tasks (Async document upload)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload a file → dispatches Celery task |
| `GET` | `/tasks/{task_id}` | Poll task status |

**GET /tasks/{task_id}** — Response:
```json
{
  "task_id": "abc-123",
  "status": "SUCCESS",
  "result": { "summary": "...", "entities": [...], "risks": [...] }
}
```

---

## 8. Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| email | String | Unique |
| hashed_password | String | bcrypt |
| created_at | DateTime | |

### `clients`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| company_name | String | |
| sector | String | Optional |
| created_at | DateTime | |

> A default client is auto-created on first brand system save.

### `brand_systems`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| client_id | FK → clients | |
| version | Integer | Increments on each update |
| brand_name | String | Required |
| brand_role | Text | Required |
| master_statement | Text | Required |
| priorities | Text | Required |
| territories | Text | Required |
| tone | Text | Required |
| red_lines | Text | Required |
| words_preferred | Text | Optional |
| words_avoid | Text | Optional |
| audiences | Text | Optional |
| sector | String | Optional |
| is_active | Boolean | Default: true |
| created_at | DateTime | |
| created_by | String | Optional |

### `analyses`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| client_id | FK → clients | |
| brand_system_id | FK → brand_systems | |
| message_title | String | |
| message_body | Text | |
| message_language | String | e.g. "fr", "en" |
| channel | String | Optional |
| audience | String | Optional |
| objective | String | Optional |
| content_type | String | Optional |
| author | String | Optional |
| campaign | String | Optional |
| clarity_score | Integer | 0–100 |
| sub_clarity | Integer | 0–20 |
| sub_alignment | Integer | 0–20 |
| sub_focus | Integer | 0–20 |
| sub_tone | Integer | 0–20 |
| sub_narrative_contribution | Integer | 0–20 |
| narrative_risk | String | Low / Medium / High |
| points_forts | Text | JSON array |
| points_faibles | Text | JSON array |
| recommandations | Text | JSON array |
| raw_output | Text | Full LLM JSON |
| analyzed_at | DateTime | |
| analyzed_by | String | Optional |

---

## 9. AI Analysis Engine

**File:** `backend/app/services/brand_analysis_service.py`

### How it works

```
1. Fetch BrandSystem from DB
2. Build structured user message:
   - Inject all brand system fields as labeled sections
   - Append message content + metadata
3. Call Groq API:
   - model: llama-3.3-70b-versatile
   - temperature: 0.1 (near-deterministic)
   - response_format: { type: "json_object" }
4. Parse JSON response
5. Validate required fields (retry once on failure)
6. Return structured dict
```

### System Prompt (exact — never modify)
The system prompt instructs the model to:
- Score 5 dimensions (0–20 each): Clarity, Alignment, Focus, Tone, Narrative Contribution
- Sum to `clarity_score` (max 100)
- Assess `narrative_risk`: Low / Medium / High
- List `points_forts`, `points_faibles`, `recommandations`
- Never output free text — only the JSON schema
- Match output language to input language

### Scoring guide
| Score | Meaning |
|-------|---------|
| 85–100 | Excellent — fully aligned, clear, impactful |
| 70–84 | Good — minor gaps |
| 50–69 | Average — generic or partially misaligned |
| 30–49 | Weak — significant issues |
| 0–29 | Critical — contradicts brand system |

> A generic mediocre message scores **50–65/100** by design. Scores are never inflated.

### Output JSON schema
```json
{
  "clarity_score": 74,
  "subscores": {
    "clarity": 16,
    "alignment": 14,
    "focus": 15,
    "tone": 15,
    "narrative_contribution": 14
  },
  "narrative_risk": "Medium",
  "points_forts": ["..."],
  "points_faibles": ["..."],
  "recommandations": ["..."]
}
```

---

## 10. Frontend — Pages & Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | `Login.tsx` | Authentication form |
| `/` | `Dashboard.tsx` | KPI cards, risk distribution, recent analyses |
| `/analyze` | `Analyze.tsx` | 3-step analysis wizard |
| `/analysis/:id` | `AnalysisResult.tsx` | Full analysis with score ring + results |
| `/brand-system/new` | `BrandSystemNew.tsx` | Create brand system |
| `/brand-system/:id/edit` | `BrandSystemEdit.tsx` | Edit brand system (version++) |
| `/history` | `History.tsx` | Filterable analysis history table |

All routes except `/login` are wrapped in `<ProtectedRoute>` — unauthenticated users are redirected to `/login`.

### Analyze Wizard — 3 steps

**Step 1 — Brand System**
- Shows clickable cards for each active brand system
- If none exist → CTA to create one

**Step 2 — Message**
- Title (required)
- Language selector (fr, en, es, de, ar, pt)
- Message body textarea (required)

**Step 3 — Metadata (optional)**
- Channel (Email, LinkedIn, Press Release, Website, etc.)
- Content Type (Communication, Article, Speech, etc.)
- Audience, Objective, Author, Campaign

On submit → loading overlay → redirect to `/analysis/{id}`

### AnalysisResult page layout
```
┌──────────────────────────────────────────┐
│ HEADER: gradient yellow→navy             │
│ Title + Narrative Risk badge             │
├──────────────────────────────────────────┤
│ Score ring (SVG)  │ Global score bar     │
│     74            │ ████████░░ 74/100    │
│    /100           │ [Medium Risk badge]  │
├──────────┬────────┬──────────┬───────────┤
│ Clarity  │Alignm. │ Focus    │ Tone  │Narr│
│   16     │  14    │   15     │  15   │ 14 │
│ ████░    │ ███░░  │ ████░    │ ███░  │ ███│
├──────────┴────────┴──────────┴───────────┤
│ ✅ Points Forts (green left border)      │
│ ⚠️ Points Faibles (amber left border)   │
│ 💡 Recommandations (navy left border)   │
├──────────────────────────────────────────┤
│ META STRIP: Brand System · Lang · Channel│
└──────────────────────────────────────────┘
```

---

## 11. Authentication Flow

```
User submits login form
    ↓
POST /login { email, password }
    ↓
Backend verifies bcrypt hash
    ↓
Returns JWT token
    ↓
Frontend stores token in localStorage
    ↓
ProtectedRoute checks isLoggedIn() on every route
    ↓
Token attached to future API requests (auth header)
    ↓
Logout → clear localStorage → redirect /login
```

**Frontend auth service** (`src/services/auth.ts`):
- `login(email, password)` → calls `/login`, stores token
- `logout()` → clears localStorage
- `isLoggedIn()` → checks token existence
- `getToken()` → returns stored JWT

---

## 12. Design System

**Theme:** Zone Bleue — Light mode, professional, editorial

### Color palette
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f5f4f0` | Page background (warm cream) |
| `--bg2` | `#ffffff` | Card background |
| `--bg3` | `#eeece8` | Input backgrounds, hover states |
| `--accent` | `#2a5298` | Deep navy — primary action color |
| `--accent-yellow` | `#fdd335` | Sidebar header, logo background |
| `--accent-hover` | `#16304e` | Button hover |
| `--text` | `#1a1814` | Primary text |
| `--text-muted` | `#6b6860` | Secondary text |
| `--text-dim` | `#a09e99` | Labels, metadata |
| `--success` | `#2e7d5e` | Low risk / good scores |
| `--warn` | `#b07d28` | Medium risk / average scores |
| `--danger` | `#c0392b` | High risk / bad scores |

### Typography
- **Headings:** Lora (serif) — `font-family: 'Lora', serif`
- **Body:** DM Sans — `font-family: 'DM Sans', sans-serif`

### Risk badge colors
| Risk | Background | Text | Border |
|------|-----------|------|--------|
| Low | green 10% | `#2e7d5e` | green 25% |
| Medium | amber 10% | `#b07d28` | amber 25% |
| High | red 10% | `#c0392b` | red 25% |

### Score interpretation
| Range | Color class | Meaning |
|-------|------------|---------|
| ≥ 75% | `.good` / green | On brand |
| 50–74% | `.warn` / amber | Needs work |
| < 50% | `.bad` / red | Off brand |

---

## 13. Test Credentials

```
Email:    admin@clarity.com
Password: Clarity123
```

### Seeded brand system
- **Brand:** Technopark (ID: 1, Version: 1)
- **Sector:** Technologie, Digital, Entrepreneuriat
- **Loaded from:** 3 PDF documents in `/technopark/`

---

## Quick Start Checklist

- [ ] Create `backend/.env` with `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`
- [ ] `cd backend && pip install -r requirements.txt`
- [ ] `cd frontend && npm install`
- [ ] Start backend: `uvicorn app.main:app --reload`
- [ ] Start frontend: `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Login: `admin@clarity.com / Clarity123`
- [ ] Go to **Analyser** → select Technopark → paste a message → run

---

*Clarity Engine — Built by Zone Bleue · Powered by Groq AI*
