# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### booking-app (React + Vite) — Preview: /
Thai-language property booking management system for a host/property owner.
- Full UI in Thai
- Booking dashboard with summary stats and sortable booking list
- New booking form with live price calculator
- Booking detail page with status management

### api-server (Express 5) — /api
Backend API for bookings with pricing logic.

## Pricing Logic

- **Daily Rate**: 600 THB (valid for 24 hours)
- **Short-stay Rate**: 300 THB (valid for up to 3 hours)
- **Overtime Fee**: 100 THB per hour beyond the included duration
- **Timezone**: Asia/Bangkok (GMT+7)

## Database Schema

### bookings
- `id` — serial primary key
- `guest_name` — text
- `check_in_at` — timestamptz
- `check_out_at` — timestamptz
- `package_type` — enum: daily | short_stay
- `payment_method` — enum: prepaid | pay_at_counter
- `status` — enum: pending | paid | checked_out
- `base_price`, `overtime_fee`, `total_price` — numeric
- `overtime_hours` — integer
- `notes` — text nullable
