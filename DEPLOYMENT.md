# Deploying Clarity Engine (GitHub + Railway) — clean setup

One Railway **project** with **three services**: Postgres, the backend, and the
frontend. Both app services deploy from the same GitHub repo
(`github.com/Abdel-1/clarity-engine`) but use different **Root Directories**.

```
backend/   -> Railway service "backend"  (FastAPI, root dir = backend)
frontend/  -> Railway service "frontend" (Vite static site, root dir = frontend)
Postgres   -> managed database
```

**Do the steps in this order** — it avoids the two chicken-and-egg traps
(`VITE_API_URL` is baked at build time; `CORS_ORIGINS` needs the frontend URL).

---

## 0. Delete the old project (start clean)
Railway → open the old project → **Settings** (project-level) → scroll to
**Danger** → **Delete Project** → confirm. This removes all old services/domains.

## 1. New project + backend service
1. **New Project → Deploy from GitHub repo → `Abdel-1/clarity-engine`**.
2. Railway creates one service. Open it → **Settings**:
   - **Service name:** `backend` (optional, for clarity)
   - **Root Directory:** `backend`
   - Start command: leave blank (the `backend/Procfile` handles it).

## 2. Add Postgres
In the project: **+ New → Database → Add PostgreSQL**. Done — it auto-exposes
`DATABASE_URL`. Never edit the Postgres service itself.

## 3. Backend variables + seeding + domain
Backend service → **Variables** → add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SECRET_KEY` | a long random string (`openssl rand -hex 32`) |
| `DEEPSEEK_API_KEY` | your DeepSeek key |
| `PORT` | `8080` |
| `ADMIN_EMAIL` | the email you want to log in with |
| `ADMIN_PASSWORD` | a strong password (≥8 chars, letters + digits) |

Backend → **Settings → Deploy → Pre-Deploy Command**:
```
python seed_admin.py
```
(Idempotent — creates the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on each deploy.)

Backend → **Settings → Networking → Generate Domain**, target port **8080**.
Copy this URL → it's your **BACKEND_URL**.

## 4. Verify the backend
- `BACKEND_URL/` → `{"message": "Clarity Engine is running", ...}`
- `BACKEND_URL/health/db` → `{"status": "database connected"}`
- The deploy's pre-deploy log shows `✅ Admin user created: <email>`.

If it 502s, open **Deploy Logs** and read the last lines (missing var, etc.).

## 5. Frontend service
1. Project → **+ New → GitHub Repo → `Abdel-1/clarity-engine`** (same repo again).
2. New service → **Settings**:
   - **Service name:** `frontend`
   - **Root Directory:** `frontend`
3. Frontend → **Variables**:

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | your **BACKEND_URL** (no trailing `/`, no `/api`) |
   | `PORT` | `8080` |

4. Frontend → **Settings → Networking → Generate Domain**, target port **8080**.
   Copy this URL → it's your **FRONTEND_URL**.

## 6. Wire CORS, redeploy backend
Backend → **Variables** → add/set:
```
CORS_ORIGINS = <FRONTEND_URL>     # e.g. https://frontend-production-xxxx.up.railway.app, no trailing /
```
Redeploy the backend (Deployments → ⋯ → Redeploy).

## 7. Log in
Open **FRONTEND_URL**, log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. 🎉

---

## Notes / gotchas we hit before
- **Root Directory must be set** on each app service, or the build fails
  ("failed to build an image") because the repo root has no single app.
- **Apps must bind `0.0.0.0`**, not localhost — already handled (uvicorn
  `--host 0.0.0.0`; `serve -l tcp://0.0.0.0:$PORT`). A localhost bind → 502.
- **`PORT` must match the domain's target port** (we use 8080 everywhere).
- **`VITE_API_URL` is build-time** — change it ⇒ redeploy the frontend.
- **`CORS_ORIGINS` must equal the frontend origin exactly** (scheme + host, no
  trailing slash) or the browser blocks login with a CORS error.
- The backend auto-creates its tables on first boot; `seed_admin.py` also
  ensures the schema, so the pre-deploy seed works on a brand-new database.

## Required backend env vars (no defaults — missing one ⇒ boot crash)
`DATABASE_URL`, `SECRET_KEY`, `DEEPSEEK_API_KEY`. Plus `PORT`, `CORS_ORIGINS`,
and (for seeding) `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
