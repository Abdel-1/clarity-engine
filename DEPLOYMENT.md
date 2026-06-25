# Deploying Clarity Engine (GitHub + Railway)

This repo is a **monorepo** with two deployable services plus a database:

```
clarity-engine/            <- git repo root (push THIS folder)
├── backend/               <- Railway service #1  (FastAPI, root dir = backend)
├── frontend/              <- Railway service #2  (Vite/React static, root dir = frontend)
└── (Railway Postgres)     <- managed database, provisioned in the dashboard
```

On Railway you create **one project** containing **three services**: Postgres,
the backend, and the frontend. Both app services deploy from the same GitHub
repo but use different **Root Directories**.

---

## Part 1 — Push the code to YOUR GitHub account

The repo currently has a remote pointing at someone else's account. You will
create a fresh repo under your own account and repoint it.

1. **Create an empty repo** on GitHub:
   - Go to <https://github.com/new>
   - Repository name: `clarity-engine`
   - Visibility: **Private** (recommended)
   - Do **NOT** add a README, .gitignore, or license (the repo already has them)
   - Click **Create repository**

2. **Repoint the local repo to yours and push.** In a terminal:
   ```bash
   cd "/Users/abdo_mnd/Desktop/zoneb/clarity-engine-7!/clarity-engine"

   # Replace YOUR-USERNAME with your GitHub username
   git remote set-url origin https://github.com/YOUR-USERNAME/clarity-engine.git

   git push -u origin main
   ```
   If GitHub asks for a password, use a **Personal Access Token** (Settings →
   Developer settings → Personal access tokens), not your account password.

3. Refresh the GitHub page — you should see `backend/`, `frontend/`, etc.

---

## Part 2 — Create the Railway project + Postgres

1. Go to <https://railway.app>, sign in **with GitHub**, and authorize Railway
   to access your `clarity-engine` repo.
2. **New Project → Deploy from GitHub repo →** pick `clarity-engine`.
   - Railway may auto-create one service. We'll configure it as the backend in
     Part 3 (and add the frontend as a second service).
3. In the project, click **+ New → Database → Add PostgreSQL**.
   - This creates a `Postgres` service that exposes a `DATABASE_URL` variable.

---

## Part 3 — Configure the BACKEND service

Open the backend service → **Settings**:

- **Root Directory:** `backend`
- **Start Command:** leave blank — the `backend/Procfile` already sets it
  (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).

Then open the backend service → **Variables** and add:

| Variable           | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `DATABASE_URL`     | `${{Postgres.DATABASE_URL}}`  ← reference the Postgres service   |
| `SECRET_KEY`       | a long random string (e.g. `openssl rand -hex 32`)               |
| `DEEPSEEK_API_KEY` | your DeepSeek key from <https://platform.deepseek.com>           |
| `CORS_ORIGINS`     | set in **Part 5** once the frontend URL exists (leave for now)   |
| `DEBUG`            | `False`                                                          |

> `${{Postgres.DATABASE_URL}}` is Railway's reference syntax — type it exactly;
> it auto-fills the real connection string and keeps it in sync.

Now expose the service publicly: backend → **Settings → Networking →
Generate Domain**. Copy the URL, e.g. `https://clarity-backend-production.up.railway.app`.
This is your **BACKEND_URL**.

The backend creates its tables automatically on first boot — no migration step.

---

## Part 4 — Configure the FRONTEND service

1. In the project: **+ New → GitHub Repo → `clarity-engine`** (add the same repo
   a second time as a new service).
2. Open the new service → **Settings**:
   - **Root Directory:** `frontend`
   - Build/start are handled by `frontend/nixpacks.toml` (builds with Vite,
     serves `dist/` with `serve`). Leave start command blank.
3. Open the frontend service → **Variables** and add:

   | Variable        | Value                                            |
   | --------------- | ------------------------------------------------ |
   | `VITE_API_URL`  | your **BACKEND_URL** from Part 3 (no trailing `/`, no `/api`) |

   > ⚠️ Vite inlines `VITE_API_URL` at **build time**. If you change it later you
   > must **redeploy** the frontend for it to take effect.

4. Frontend → **Settings → Networking → Generate Domain**. Copy this URL —
   it's your **FRONTEND_URL** (the public app address).

---

## Part 5 — Wire CORS, then redeploy

The backend rejects browser calls from unknown origins, so it must be told the
frontend's address.

1. Backend service → **Variables** → set:
   ```
   CORS_ORIGINS = https://YOUR-FRONTEND-URL.up.railway.app
   ```
   (your **FRONTEND_URL** from Part 4, no trailing slash. Comma-separate if you
   later add a custom domain.)
2. Redeploy **backend** (Deployments → ⋯ → Redeploy) so the new CORS value loads.
3. If you set `VITE_API_URL` after the frontend's first build, redeploy
   **frontend** too.

---

## Part 6 — Verify

- Visit `BACKEND_URL/` → `{"message": "Clarity Engine is running", ...}`
- Visit `BACKEND_URL/health/db` → `{"status": "database connected"}`
- Visit `FRONTEND_URL` → the app loads and can log in / call the API with no
  CORS errors in the browser console.

You will need to seed an admin user. From your machine, with the backend's
`DATABASE_URL` exported locally (or via `railway run`), run the project's
`backend/seed_admin.py`. Ask if you want a one-off seed step wired in.

---

## Environment variables — quick reference

**Backend** (required unless noted): `DATABASE_URL`, `SECRET_KEY`,
`DEEPSEEK_API_KEY`, `CORS_ORIGINS`, `DEBUG` (default `False`),
`DEEPSEEK_TIMEOUT` (default 30), `ANALYZE_BURST_PER_MINUTE` (default 15),
`TENANT_DAILY_TOKEN_BUDGET` (default 0).

**Frontend**: `VITE_API_URL` (build-time).

## Troubleshooting

- **Backend boot-loops / "field required" error** → a required variable
  (`DATABASE_URL`, `SECRET_KEY`, or `DEEPSEEK_API_KEY`) is missing.
- **CORS error in browser** → `CORS_ORIGINS` doesn't exactly match the frontend
  origin (scheme + host, no trailing slash); fix and redeploy backend.
- **Frontend calls `127.0.0.1:8000`** → `VITE_API_URL` wasn't set at build time;
  set it and redeploy the frontend.
- **Data disappears after redeploy** → backend is using SQLite, not the Postgres
  `DATABASE_URL`. Confirm the variable references `${{Postgres.DATABASE_URL}}`.
