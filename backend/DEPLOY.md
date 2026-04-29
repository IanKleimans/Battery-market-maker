# Deploying the backend to Railway

The backend is a containerised FastAPI service. Railway builds it from
`backend/Dockerfile` (which is configured via `backend/railway.json` to be
the dockerfile path).

## Prerequisites

- A Railway account (https://railway.app)
- The Railway CLI (`npm i -g @railway/cli`) — optional but useful
- This repo pushed to GitHub

## Step-by-step

### 1. Create the project

```bash
railway login
railway init   # from the repo root, name the project battery-market-maker-api
```

Or via the Railway dashboard: **New Project → Deploy from GitHub repo → select this repo**.

### 2. Configure the build

Railway should auto-detect `backend/railway.json`. If not, set:

- **Root Directory**: `/` (the build needs `src/` from the parent for the SDP wrapper)
- **Builder**: Dockerfile
- **Dockerfile Path**: `backend/Dockerfile`
- **Watch Paths**: `backend/**, src/**, pyproject.toml`

### 3. Environment variables

Set these in the Railway service settings:

| Variable          | Value                                     | Notes                                  |
|-------------------|-------------------------------------------|----------------------------------------|
| `CORS_ORIGINS`    | `https://your-vercel-domain.vercel.app`   | Frontend origin(s), no trailing slash  |
| `PORT`            | (auto)                                    | Railway injects this — don't override  |

> **Watch out — `CORS_ORIGINS` must have no trailing slash.** Origins are
> matched as exact strings; `https://example.com/` will silently fail the
> preflight. Comma-separate multiple origins.

### 4. Public Networking target port

> **Watch out — Railway overrides `PORT`.** The Dockerfile defaults to 8000,
> but at deploy time Railway injects its own value (currently 8080). In
> **Settings → Networking → Public Networking**, set the **Target Port** to
> the value Railway assigns (typically `8080`) so the public URL forwards
> traffic to the right container port. If the public URL returns 502 right
> after deploy, this mismatch is the most common cause — confirm the port in
> the deploy logs (`Uvicorn running on http://0.0.0.0:<port>`) and update the
> target port to match.

### 5. Health check

`railway.json` already points the health check at `/health`. Railway will mark
the deployment healthy once that returns 200.

### 6. Custom domain

In **Settings → Networking** add a custom domain like `api.battery-market-maker.com`,
then set a CNAME record in your DNS provider:

```
api.battery-market-maker.com   CNAME   <railway-provided-target>
```

SSL is provisioned automatically.

### 7. Updating the frontend

After the API URL is final, set `VITE_API_BASE_URL` in the Vercel project to
`https://api.<your-domain>` and redeploy the frontend.

## Local Docker test

```bash
# from the repo root:
docker build -f backend/Dockerfile -t bmm-api .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=http://localhost:5173 bmm-api
curl http://localhost:8000/health
```

## Logs

```bash
railway logs            # live tail
railway logs --json     # structured
```

## Troubleshooting

**Solver fails on Railway but works locally** — HiGHS bundles a native binary
that occasionally trips on minimal Linux base images. The Dockerfile installs
`libgomp1` to handle this; verify it's in the build logs.

**Cold-start time** — first request after a deploy can take 10–15 seconds
while cvxpy + HiGHS warm up. Subsequent requests are sub-second.
