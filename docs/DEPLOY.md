# Deploying the application

Two services, two providers:

* **Backend** → Railway (Docker build).
* **Frontend** → Vercel (Vite build).

The current production deployment is at:

* App: <https://battery-market-maker.vercel.app>
* API: <https://battery-market-maker-production.up.railway.app>

## 1. Backend on Railway

See `backend/DEPLOY.md` for the full step-by-step. Short version:

```bash
railway login
railway init   # name: battery-market-maker-api
```

Or via the Railway dashboard, **New Project → Deploy from GitHub repo** and pick this repository. Railway auto-detects `backend/railway.json`.

### Environment variables

| Variable        | Value                                                                  |
|-----------------|------------------------------------------------------------------------|
| `CORS_ORIGINS`  | `https://battery-market-maker.vercel.app` (or your custom domain)      |

> **Gotcha — `CORS_ORIGINS` must not include a trailing slash.** Origins are matched as exact strings. `https://battery-market-maker.vercel.app/` will fail the preflight check; use `https://battery-market-maker.vercel.app` (no slash). Multiple origins are comma-separated.

### Port mapping

> **Gotcha — Railway overrides `PORT`.** The Dockerfile defaults `PORT=8000` and uvicorn binds to `$PORT`, but Railway injects its own value at runtime (currently 8080). In **Settings → Networking → Public Networking**, set the **Target Port** to **`8080`** (or whatever value `echo $PORT` shows in the deploy logs) so the public URL forwards traffic to the container's listening port.

If the public URL returns a 502 right after deploy, this mismatch is the most likely cause. Check the deploy logs for the line `Uvicorn running on http://0.0.0.0:<port>` and make sure that port matches the Networking target.

### Custom domain (optional)

In **Settings → Networking** add a custom domain (e.g. `api.battery-market-maker.com`) and create a CNAME record pointing at the Railway-provided target.

## 2. Frontend on Vercel

```bash
cd frontend
vercel link
vercel env add VITE_API_BASE_URL production   # https://battery-market-maker-production.up.railway.app
vercel deploy --prod
```

Or via the Vercel dashboard: **New Project → Import Git Repository** and pick the same repo. Set:

* **Root Directory**: `frontend`
* **Framework Preset**: Vite
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment**: `VITE_API_BASE_URL = https://battery-market-maker-production.up.railway.app` (production)

`VITE_API_BASE_URL` should also have **no trailing slash** — the client appends `/api/v1/...` directly.

Add a custom domain (e.g. the apex `battery-market-maker.com`); Vercel will auto-provision SSL. Set the apex A record to Vercel's IP and the `www` CNAME to `cname.vercel-dns.com`.

## 3. DNS summary (custom-domain setup)

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

## 7. Common deploy errors

| Symptom                                       | Cause                                                  | Fix                                                          |
|-----------------------------------------------|--------------------------------------------------------|--------------------------------------------------------------|
| Frontend loads but API calls fail with CORS   | `CORS_ORIGINS` has trailing slash or wrong domain      | Set `CORS_ORIGINS=https://app.example.com` exactly, redeploy |
| Public URL returns 502 right after Railway deploy | Public Networking target port doesn't match container | Set target port to 8080 (or whatever `$PORT` resolves to)    |
| First request takes 10–15 s                   | cvxpy + HiGHS cold start                               | Expected — keep the service warm with a `/health` cron       |
| WebSocket disconnects immediately             | API base URL is `http://...` instead of `https://...`  | Use `https://...` so WS upgrades to `wss://`                 |
