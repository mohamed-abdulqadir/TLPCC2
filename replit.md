# Accident & Incident Tracker

A confidential, mobile-friendly accident and incident tracker for early years charity staff.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/accident-tracker run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`; Clerk keys are provisioned and managed by Replit.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React, Vite, Wouter, TanStack Query, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Authentication: Replit-managed Clerk

## Where things live

- `artifacts/accident-tracker/` — staff-facing dashboard, accident register/form, action tracker, and mobile navigation.
- `artifacts/api-server/src/routes/` — authenticated accident, dashboard, and action APIs.
- `lib/db/src/schema/` — PostgreSQL accident and action tables.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks.

## Architecture decisions

- Data routes require a signed-in Clerk session; public account registration is intentionally not exposed.
- Demo names and incident details are fictional and must remain synthetic.
- Accident and action records are shared across staff accounts; roles and per-record permissions are not part of this MVP.
- Register export is CSV that opens in Excel; attachments and handwritten-form OCR are future work.

## Product

- Record accidents, search and filter the register, and export records for Excel.
- Review this month's accident total and breakdowns by room, location, and accident type.
- Create improvement actions and track ownership, due dates, status, and overdue work.
- Future additions: form uploads, OCR, AI trend analysis, and near-miss reporting.

## User preferences

No additional project-specific preferences have been provided.

## Gotchas

- Provision staff accounts through the app's Auth controls; do not add open self-registration without an approved access policy.
- After editing `lib/api-spec/openapi.yaml`, run codegen before typechecking app packages.
- Production schema changes are applied through the Publish flow; `db push` targets development only.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
