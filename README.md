# Builders Node Community Dashboard

Full-stack Builders Node member/applicant account system with real local auth, admin approval, and a database-backed dashboard.

## Structure

- `Backend` — NestJS API with Prisma and a Postgres database (Supabase in production).
- `Frontend` — React + Vite dashboard UI.

## Backend

```bash
cd Backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm test
npm run build
npm run start:dev
```

The backend includes modules for auth, admin, applications, users/profile, E-Residency, subscriptions, payments, apartments, and support. User account routes are protected with JWT bearer tokens; admin routes require `x-admin-key`.

External systems are isolated behind adapter services:

- `Backend/src/subscriptions/prospera-sub.client.ts`

## Database

The backend uses **Postgres** via Prisma. In production it runs on Supabase (see
`DEPLOY.md` for the pooled-vs-direct connection details). For local development,
start the bundled Postgres and use the defaults in `Backend/.env`:

```bash
docker compose up -d postgres          # local Postgres
cd Backend
cp .env.example .env                    # then fill in the secrets
npm run prisma:migrate                  # apply migrations to the local DB
npm run prisma:generate
```

`DATABASE_URL` is the pooled connection; `DIRECT_URL` is the direct connection used
for migrations. Production migrations are applied with `npm run prisma:deploy`
against `DIRECT_URL` (see `DEPLOY.md`).

## Frontend

```bash
cd Frontend
npm install
npm run build
npm run dev
```

Open `http://localhost:5173`.

If 5173 is already in use, Vite will print the next available port, such as `http://localhost:5174`.

## Current Integration State

The app is wired to real backend routes and Postgres data. Prospera integrations are adapter-based and use fallback mock responses until API keys and exact contracts are available.

Required next production steps:

- Add real `prospera.co` E-Residency API calls.
- Add real `ProsperaSub.com` plan activation/status calls.
- Connect PostgreSQL and run Prisma migrations.
- Add transactional email delivery for verification and password reset.
