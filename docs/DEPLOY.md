# Deploying the application

Two services, two providers:

* **Backend** → Railway (Docker build).
* **Frontend** → Vercel (Vite build).

## 1. Backend on Railway

See `backend/DEPLOY.md` for the full step-by-step. Short version:

```bash
railway login
railway init   # name: battery-market-maker-api
```

Or via the Railway dashboard, **New Project → Deploy from GitHub repo** and pick this repository. Railway auto-detects `backend/railway.json`.

Set environment variables on the service:

| Variable        | Value                                            |
|-----------------|--------------------------------------------------|
| `CORS_ORIGINS`  | `https://battery-market-maker.vercel.app` (or your custom domain) |

In **Settings → Networking** add a custom domain (e.g. `api.battery-market-maker.com`) and create a CNAME record pointing at the Railway-provided target.

## 2. Frontend on Vercel

```bash
cd frontend
vercel link
vercel env add VITE_API_BASE_URL production   # https://api.battery-market-maker.com
vercel deploy --prod
```

Or via the Vercel dashboard: **New Project → Import Git Repository** and pick the same repo. Set:

* **Root Directory**: `frontend`
* **Framework Preset**: Vite
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment**: `VITE_API_BASE_URL = https://api.<your-domain>` (production)

Add a custom domain (e.g. the apex `battery-market-maker.com`); Vercel will auto-provision SSL. Set the apex A record to Vercel's IP and the `www` CNAME to `cname.vercel-dns.com`.

## 3. DNS summary

| Record | Host  | Value                                     |
|--------|-------|-------------------------------------------|
| A      | `@`   | Vercel apex IP                             |
| CNAME  | `www` | `cname.vercel-dns.com`                    |
| CNAME  | `api` | Railway-provided target                   |

## 4. CI

`.github/workflows/ci.yml` runs:

* `pytest` for `tests/` (research code, 69 tests)
* `pytest` for `backend/tests/` (30 tests)
* `npm run lint && npm run test && npm run build` for `frontend/`

Add the workflow when you push the repo to GitHub. The deploy buttons in the README do not require this workflow.

## 5. Health and observability

* Backend: `GET /health` on Railway with a 30-second timeout.
* Frontend: Vercel's analytics covers basic web-vitals.
* Solver issues: backend logs to stdout (Railway log drain). Cold-start latency is ≈10–15 s for the first request after deploy because cvxpy + HiGHS warm up.

## 6. One-click deploy buttons

The README has Railway and Vercel deploy buttons that point at the public repository. Forking the repo and clicking through gives anyone a clone of the application running under their own accounts, with each provider provisioning their service in isolation.
