# Builders Node Community Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Builders Node account dashboard scaffold with `Backend` and `Frontend` folders.

**Architecture:** `Backend` is a NestJS API organized into domain modules with Prisma PostgreSQL schema and mockable external adapters. `Frontend` is a React + Vite dashboard with typed fixture data, dark/light mode, responsive navigation, and pages for account, residency, subscriptions, dues, apartments, about, and support.

**Tech Stack:** NestJS, React, Vite, TypeScript, Prisma, PostgreSQL, JWT-ready auth, CSS modules via plain CSS.

---

### Task 1: Backend Domain Scaffold

**Files:**
- Create `Backend/package.json`
- Create `Backend/src/main.ts`
- Create `Backend/src/app.module.ts`
- Create domain modules, controllers, services, DTOs, and tests.

- [x] Create NestJS package metadata and TypeScript config.
- [x] Create domain modules for auth, users, residency, subscriptions, payments, apartments, and support.
- [x] Add Prisma schema for PostgreSQL.
- [x] Add status logic tests.

### Task 2: Frontend Dashboard Scaffold

**Files:**
- Create `Frontend/package.json`
- Create `Frontend/src/App.tsx`
- Create `Frontend/src/pages/*`
- Create `Frontend/src/components/*`
- Create `Frontend/src/styles.css`

- [x] Create Vite React package metadata.
- [x] Build app shell with responsive navigation and theme toggle.
- [x] Add all requested pages and dashboard quick actions.
- [x] Add typed fixture data and API client boundary.

### Task 3: Verification

- [x] Install dependencies where possible.
- [x] Run backend tests.
- [x] Run frontend build.
- [x] Update memory for the generated project files.
