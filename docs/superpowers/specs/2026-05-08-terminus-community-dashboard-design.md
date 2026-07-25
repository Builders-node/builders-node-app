# Builders Node Community Dashboard Design

## Goal

Build a full-stack account system for terminus.town with two top-level folders: `Backend` for the NestJS API and `Frontend` for the React dashboard. The first build is a working local scaffold with realistic data models, dashboard flows, and external API adapters that can be connected to real Prospera credentials later.

## Product Scope

The platform serves applicants and members. It separates Builders Node membership from Prospera E-Residency, because an applicant can be in progress with one system while approved or blocked in the other. The dashboard gives users one place to see membership, E-Residency progress, subscription plan, dues, apartment requests, and support.

## Backend Architecture

NestJS modules are split by domain: auth, users, residency, subscriptions, payments, apartments, and support. External systems are represented by adapter services so controllers do not know whether data comes from mock fixtures, `prospera.co`, or `ProsperaSub.com`. PostgreSQL is modeled through a Prisma schema.

Auth is JWT-ready and includes signup, login, email verification, password reset request, and profile endpoints. Local passwords are hashed in service code once dependencies are installed. The scaffold intentionally stores only necessary residency information: external application id, status, stage, required next steps, timestamps, and error state.

## Frontend Architecture

React + Vite renders the account experience. The UI has a premium minimal dashboard shell with light/dark mode, responsive navigation, status cards, quick actions, and page-level flows for all requested areas. Data is currently local typed fixture data, with API helpers prepared for Backend calls.

## Data Model

Core tables include users, profiles, membership records, residency applications, subscription plans, payment records, apartments, rental requests, support tickets, email verification tokens, password reset tokens, and audit events. Status fields are explicit enums so UI warnings and next steps stay predictable.

## Error Handling

Backend integration adapters normalize remote failures into clear API errors. Frontend pages show concise user-facing status text and keep operational states separated: membership issues do not imply E-Residency failure, and subscription issues do not imply apartment request failure.

## Verification

The scaffold should install dependencies, run backend unit tests for domain status logic, and run the frontend build. Local API integration tests can be added once real external API contracts are available.
