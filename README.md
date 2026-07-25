# Builders Node Community Dashboard

Full-stack Builders Node member/applicant account system with real local auth, admin approval, and a database-backed dashboard.

## Structure

- `Backend` — NestJS API with Prisma and a local SQLite database.
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

- `Backend/src/residency/prospera-residency.client.ts`
- `Backend/src/subscriptions/prospera-sub.client.ts`

## Database

The backend is configured with Prisma and a local SQLite database for development because this machine does not have Docker, Homebrew, or PostgreSQL installed.

Local database file:

```bash
Backend/prisma/dev.db
```

Connection string:

```bash
DATABASE_URL="file:./dev.db"
```

The first migration is stored in `Backend/prisma/migrations/20260511134500_init_sqlite/migration.sql`.

To recreate the local DB without Prisma's migration engine:

```bash
cd Backend
rm -f prisma/dev.db
sqlite3 prisma/dev.db < prisma/migrations/20260511134500_init_sqlite/migration.sql
npm run prisma:generate
```

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

The app is wired to real local backend routes and SQLite data. Prospera integrations are adapter-based and use fallback mock responses until API keys and exact contracts are available.

Required next production steps:

- Add real `prospera.co` E-Residency API calls.
- Add real `ProsperaSub.com` plan activation/status calls.
- Connect PostgreSQL and run Prisma migrations.
- Add transactional email delivery for verification and password reset.
