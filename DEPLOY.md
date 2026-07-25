# Deployment guide — Builders Node

## Architecture

Three moving parts:

| Part | Tech | Runtime | Notes |
|------|------|---------|-------|
| **API** (`Backend/`) | NestJS + Prisma | Node.js server | REST API on port `3000` |
| **Web** (`Frontend/`) | React + Vite | Static files | SPA served by any static host / nginx |
| **Database** | Postgres (Supabase or any) | Managed / external | via `DATABASE_URL` + `DIRECT_URL` |

The browser loads the static **Web** app, which calls the **API** at `VITE_API_BASE_URL`.
The API reads/writes the **Database** and talks to Prospera / ProsperaSub.

## Repo structure

```
Backend/                 NestJS API (deploy this)
  src/                   controllers, services, guards
  prisma/                schema.prisma (Postgres) + migrations/ (builds from scratch)
  Dockerfile             API image
  .env.example           API env template
Frontend/                React SPA (deploy this)
  src/                   app code
  Dockerfile             web image (build → nginx)
  nginx.conf             SPA fallback + caching
  .env.example           web env template
docker-compose.prod.yml  One-command production stack (API + web; external Postgres)
docker-compose.yml       Local-dev Postgres (use for local development)
.env.example             Root env for docker-compose.prod.yml
```

## Environment variables

**API** (`Backend/.env`) — see `Backend/.env.example`:

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | yes | Postgres, pooled (Supabase 6543, `?pgbouncer=true`) — app runtime |
| `DIRECT_URL` | yes | Postgres, direct (Supabase 5432) — used for migrations only |
| `JWT_SECRET` | yes | signs sessions — `openssl rand -hex 32` |
| `ADMIN_ACCESS_KEY` | yes | gates admin bootstrap |
| `PORT` / `HOST` | no | default `3000` / `0.0.0.0` (0.0.0.0 required in containers) |
| `FRONTEND_URL` | yes | web origin, for CORS |
| `GOOGLE_CLIENT_ID` | no | Google login (empty = disabled) |
| `PROSPERA_SUB_API_KEY` | no | server-side secret — never expose to the browser |

**Web** (`Frontend/.env`) — see `Frontend/.env.example`. These are **build-time** (Vite
inlines them), so they must be set when you build the web image, not at runtime:

| Var | Purpose |
|-----|---------|
| `VITE_API_BASE_URL` | public URL of the API (e.g. `https://api.yourdomain.com`) |
| `VITE_GOOGLE_CLIENT_ID` | same value as the API's `GOOGLE_CLIENT_ID` |

## Option A — Docker Compose (one command)

```bash
cp .env.example .env      # fill DATABASE_URL + DIRECT_URL, JWT_SECRET, ADMIN_ACCESS_KEY, URLs, keys
docker compose -f docker-compose.prod.yml up -d --build
```

- Web → http://localhost:8080  ·  API → http://localhost:3000
- The database is external (Supabase / any Postgres); migrations run automatically on
  startup (`prisma migrate deploy`, via `DIRECT_URL`).
- Behind a real domain, put a reverse proxy (Caddy/nginx/Traefik) in front and set
  `FRONTEND_URL`, `VITE_API_BASE_URL` to the public HTTPS URLs, then rebuild the web
  image (`--build`) so the new API URL is baked in.

## Option B — Managed platforms

- **API** on Render / Railway / Fly.io:
  - Build: `npm ci && npm run build`
  - Start: `npm run prisma:deploy && npm run start:prod`
  - Set all `Backend/.env` vars, including `DATABASE_URL` (pooled) + `DIRECT_URL` (direct).
- **Web** on Vercel / Netlify / Cloudflare Pages:
  - Root: `Frontend/` · Build: `npm run build` · Output: `dist`
  - Set `VITE_API_BASE_URL` + `VITE_GOOGLE_CLIENT_ID` as build env vars.
  - Add an SPA rewrite (all paths → `/index.html`) so `/apply` deep links work.

## Pre-flight checklist

- [ ] `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) both set to your Postgres.
- [ ] `JWT_SECRET` and `ADMIN_ACCESS_KEY` set to strong unique values (not the samples).
- [ ] `FRONTEND_URL` = the exact web origin (scheme + host + port) → CORS.
- [ ] `VITE_API_BASE_URL` = the public API URL, set **before** building the web app.
- [ ] Google login: add the web origin to the OAuth client's *Authorized JavaScript
      origins*, and set `GOOGLE_CLIENT_ID` = `VITE_GOOGLE_CLIENT_ID`.
- [ ] `PROSPERA_SUB_API_KEY` kept server-side only.

## Database — Supabase (Postgres)

The app uses **Postgres** via Prisma. Supabase is the easiest managed option.

1. Create a project at supabase.com. Then **Project Settings → Database → Connection string**.
2. Copy two connection strings into your env:
   - `DATABASE_URL` = **Transaction** pooler (host `...pooler.supabase.com`, port **6543**);
     append `?pgbouncer=true`. This is what the API uses at runtime.
   - `DIRECT_URL` = **Session / direct** connection (port **5432**). Prisma uses this only
     for migrations (DDL can't run through the transaction pooler).
3. Apply the schema: `npm run prisma:deploy` (or it runs automatically in the Docker image
   / Render start command). The migration builds all tables from scratch.

**Local development:** run the bundled Postgres with `docker compose up -d postgres`, then
keep the default `DATABASE_URL` / `DIRECT_URL` in `Backend/.env` (they point at it).
