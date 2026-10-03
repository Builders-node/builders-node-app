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

> ⚠️ **Vercel / serverless: you MUST use the pooler host, not the direct host.**
> Supabase's direct host (`db.<ref>.supabase.co`) resolves to **IPv6 only**, and Vercel
> functions have no outbound IPv6 — so a direct connection fails with a 500 at runtime.
> The pooler host (`aws-0-<region>.pooler.supabase.com`) is IPv4. On Vercel set BOTH:
> - `DATABASE_URL` → `...@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`
> - `DIRECT_URL`   → `...@aws-0-<region>.pooler.supabase.com:5432/postgres`
>
> The pooler username is `postgres.<project-ref>` (note the dot), not plain `postgres`.

**Local development:** run the bundled Postgres with `docker compose up -d postgres`, then
keep the default `DATABASE_URL` / `DIRECT_URL` in `Backend/.env` (they point at it). A
laptop usually has IPv6, so the direct Supabase host also works locally.

## Database migrations (production)

**Applied automatically by CI** — the `migrate` job in
`.github/workflows/ci.yml`, on every push to `main`, after the backend tests
pass. It needs a repository secret named `DIRECT_URL`: the direct 5432
connection string, not the pooler, because pgbouncer can't run DDL.

> GitHub → repo → Settings → Secrets and variables → Actions → New repository
> secret → `DIRECT_URL`.

**And in the production Vercel build, when it can.** Vercel deploys on push
while the CI job waits for the tests, so for a few minutes new code ran against
the old schema and every request touching a new column failed. The backend's
`vercel-build` (`Backend/scripts/vercel-build.sh`) runs `migrate deploy` first —
only when `VERCEL_ENV=production` and `DIRECT_URL` is set in the API project's
Vercel env (add it there to switch this on; preview builds never migrate).
Overlap is safe: `migrate deploy` takes a lock and only applies migrations not
recorded in `_prisma_migrations`, so whichever runs second is a no-op.

CI also fails the backend job if `schema.prisma` and the migrations drift
(`prisma migrate diff` against a throwaway Postgres), and the migrate job
waits for it.

To apply them by hand — the first time, or if the secret isn't set yet:

```bash
cd Backend
set -a && . ./.env && set +a
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

`npx prisma migrate status` against the same URL says what is still pending.

## ca.buildersnode.com — the second marketing site

A separate landing site served from the **same build and the same Vercel
project**. `src/main.tsx` picks it by hostname and renders `src/sites/ca/`
instead of the member app; nothing in `App.tsx` knows it exists, so pages and
sections added there cannot affect the product.

It hosts marketing pages only. Apply, log in and the member area stay on the
apex domain, because `localStorage` is per-origin — a session started on the
subdomain would be invisible on `buildersnode.com`, and one person would end up
with two accounts and two half-finished funnels. Every call to action leaves for
the apex domain, and Apply carries `?src=ca`.

To put it live:

1. Vercel → the frontend project → **Settings → Domains** → add
   `ca.buildersnode.com`. Same project, no second deployment.
2. DNS: a `CNAME` for `ca` pointing at `cname.vercel-dns.com` (Vercel shows the
   exact target when you add the domain).
3. Nothing to do for the API. CORS already allows any `*.buildersnode.com`
   host — see `makeCorsOrigin` in `Backend/src/app-setup.ts`.
4. Optional: Admin → Settings → Traffic, create a link with the code `ca`, and
   applications that started on the subdomain show up in the traffic report. An
   unrecognised `?src=` is dropped rather than inventing a row, so until that
   link exists the code is simply ignored.

**Indexing.** The subdomain is kept out of Google by an `X-Robots-Tag:
noindex, nofollow` header scoped to that hostname in `Frontend/vercel.json`, and
by a `robots` meta the site sets on boot. A header is used rather than
`robots.txt` for two reasons: both hosts serve the same `public/robots.txt` and
cannot be told apart by it, and `robots.txt` only stops crawling where the
header actually deindexes. To let the subdomain be indexed later, drop the
`headers` block and the meta rewrite in `src/sites/ca/CaSite.tsx`, and give it a
canonical of its own.

**Working on it locally.** `http://localhost:5173/?site=ca` renders the CA site
(the query is ignored on the apex domain, so a stray link cannot replace the
real homepage). Set `VITE_MAIN_SITE_URL` in `Frontend/.env` to keep its buttons
on your dev server instead of production.

**The guide.** The landing's main call to action is "Send me guide": an email
address in exchange for a key, which is a much smaller promise than applying, so
the leads are kept in their own table and never enter the applicant pipeline.

**Nothing about it is configured.** Each reader is emailed a key of their own
the moment they ask — minted on the spot, stored against their address, and
reused if they ask again, because the first one is already in their inbox. The
key is checked server-side and the guide's location is returned only when it
resolves to somebody, so the gate is not something a visitor can read out of the
JavaScript.

The guide is a page, not a file: a Claude Design canvas export, served as it
was authored because it ships its own runtime for the contents list, the flight
widget and the mobile layout. Rewriting it into components would mean
reimplementing that — and redoing it on every edit of the guide.

Import a new export with:

```bash
cd Frontend && node scripts/import-guide.mjs ~/Downloads/"Builders Node Private Guide.zip"
```

That drops the duplicate `uploads/` folder, re-encodes the photos (one was
5921px wide and 10MB) keeping each result only when it is actually smaller, and
writes the page to `Frontend/public/g/winter-2026-k7m2qx/`. Last run: 44MB → 19MB.

It also repairs what the export leaves behind, so none of it has to be redone
by hand after an edit: one stray `</div>` that closed the content column
halfway down (everything from the Roatán section onward rendered full-bleed at
the left edge while the sections above stayed in the column), the document gets
`margin: 0` and a white background
(the export styles its own wrapper and leaves an unpainted frame around it), the
dead "Download as PDF" link and the "Prepared for" line are removed, and the
four Apply buttons — `<button>` elements the canvas only wires up in its editor
— become real links to the apply form, carrying UTM tags so GA4 can separate
people who applied after reading the guide. Each of those steps warns rather
than failing silently if a future export stops matching.

Static hosting can't check a key, so **that path is the gate**: it isn't
guessable, isn't linked from anywhere, and the unlock endpoint is the only thing
that hands it out. Change it in the script and in `GUIDE_PATH`
(`Backend/src/guide/guide.service.ts`) together. `index.html` is spelled out in
that path on purpose — the SPA catch-all answers a bare directory with the app
shell, which serves the landing page where the guide should be.

There are two guides, one per site, differing only in section 05: the CA
one (`Guide.dc.html` in the export) is "Getting here from Canada", the main
one (`Guide v2.dc.html`) covers the US, Canada, Europe, South America and Asia.
Import each with its site name:

```
cd Frontend
node scripts/import-guide.mjs ~/Downloads/"Builders Node Private Guide.zip" ca
node scripts/import-guide.mjs ~/Downloads/"Builders Node Private Guide.zip" main
```

The main site's gate is `buildersnode.com/guide` — not in the menu, only
reached through links sent by hand; the CA one is `ca.buildersnode.com/guide`. A key opens whichever site's
guide it is entered on. The email's one-tap link goes to the site the reader
asked on — `FRONTEND_URL` for the main site, `CA_SITE_URL` for CA (defaults to
`https://ca.buildersnode.com`).

**Shared code.** `BN-GUIDE-2026` opens the guide for anybody, with no email
asked for — for links handed out by hand:
`https://buildersnode.com/guide?key=BN-GUIDE-2026`. Setting `GUIDE_SHARED_KEY`
on the API replaces it if a link travels further than it should.

**Admin → Settings → Guide leads** is a list, not a form: who asked, their key,
whether the email went out, and whether they ever opened it. Deleting a lead
takes their key with them, which is the one thing a shared key could never do.

**Adding a page.** Two lines in `src/sites/ca/site.ts` (`CA_PATHS`,
`CA_PATH_TO_PAGE`, `CA_TITLES`) plus the component under
`src/sites/ca/pages/`. Tailwind already scans the whole `src/sites/**` subtree.
Sections that should differ from the apex site get their own copy under
`src/sites/ca/components/` — `CaNavbar` and `CaHeroSection` are already that.

## Pipeline automation and admin tiers

**Daily jobs** (`Backend/vercel.json`, both need `CRON_SECRET`):
- `/jobs/daily` 13:00 UTC — billing, overdue notices, cleanup of expired codes,
  tokens and old notifications.
- `/jobs/nudges` 16:00 UTC — capped follow-ups: "book your call" (day 3, day 7),
  "payment link waiting" (day 2, +3 days), one "finish your application" email
  with a 48-hour code, two notes after the guide (day 2, day 6; stop when they
  apply), and a digest to each Super Admin of applicants waiting on us > 5 days.
  Nothing reaches back more than two weeks.

**Env:**
- `MAIL_REPLY_TO` — Reply-To on emails that invite a reply (default
  `taras@buildersnode.com`).
- `PAYMENT_LINK_HOSTS` — comma-separated hosts a non-Super-Admin may send a
  payment link on (default prosperasub.com, stripe.com, paypal.com, wise.com,
  revolut.me, buildersnode.com; subdomains count).
- `GUIDE_SHARED_KEY` — replaces the shared guide code `BN-GUIDE-2026`.
- `ALLOW_VERCEL_ORIGINS=false` — recommended: stops any `*.vercel.app` origin
  being allowed by CORS.

**Admin tiers.** Super Admin only: activating memberships, confirming payments,
invoices, plan prices, global meal/cleaning/batch settings, the affiliate
reward and payouts, a member's billing amount, and messaging every member at
once. Moderators and community leaders run the pipeline (checks, reminders,
payment links on the allowed hosts, declines) and the day-to-day queues.

## Error tracking (optional)

The API ships a global exception filter that logs every 5xx with a stack trace —
visible in the Vercel function logs, so you have baseline observability out of the
box. To add Sentry later: `npm i @sentry/node`, init it when `SENTRY_DSN` is set,
and call `Sentry.captureException` from `AllExceptionsFilter` for 5xx responses.

## Transactional email

Set `RESEND_API_KEY` and `MAIL_FROM` (a verified sender/domain) to enable
password-reset, email-verification and invitation emails. Without the key those
emails are logged instead of sent — no errors, but users won't receive them.

## Discord verification (optional)

Links a member's Builders Node account to Discord and auto-grants a server role.
Set these on the **API** Vercel project; leave them empty to hide the feature.

1. Create an application + bot at https://discord.com/developers/applications.
2. **OAuth2 → Redirects**: add `https://api.buildersnode.com/auth/discord/callback`
   (must exactly match `DISCORD_REDIRECT_URI`).
3. Invite the bot to your server with the **Manage Roles** permission, and in
   Server Settings → Roles drag the **bot's role above** the roles it will assign.
4. Copy the ids/secrets into env vars:

```
DISCORD_CLIENT_ID       # OAuth2 client id
DISCORD_CLIENT_SECRET   # OAuth2 client secret
DISCORD_BOT_TOKEN       # Bot → Token
DISCORD_GUILD_ID        # right-click the server → Copy Server ID (dev mode on)
DISCORD_REDIRECT_URI    # https://api.buildersnode.com/auth/discord/callback
DISCORD_ROLE_MEMBER     # role id granted to ACTIVE members
DISCORD_ROLE_APPLICANT  # (optional) role id for applicants; falls back to MEMBER
```

Members then see a **Connect Discord** card in their profile: it runs the OAuth
consent, and the bot adds them to the server (if needed) and assigns the role.
