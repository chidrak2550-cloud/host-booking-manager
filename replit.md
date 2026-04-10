# ระบบจัดการการจอง — Property Booking Management System

## Overview
A Thai-language web-based booking management system for a property host with 5 rooms. Built as a full-stack React + Express app in a pnpm monorepo.

## Architecture

### Monorepo Structure
```
artifacts/
  api-server/         — Express API server (port 8080)
  booking-app/        — React + Vite frontend (dynamic port via $PORT)
lib/
  api-client-react/   — Generated React Query hooks (via Orval codegen)
  api-zod/            — Generated Zod schemas (via Orval codegen)
  api-spec/           — OpenAPI spec (openapi.yaml)
  db/                 — Drizzle ORM schema + connection
```

### Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Wouter (routing), React Query, Framer Motion
- **Backend**: Express, TypeScript (ESM), Pino logging
- **Database**: PostgreSQL via Drizzle ORM
- **API**: OpenAPI 3.0 spec → Orval codegen → type-safe hooks + Zod validators
- **Package manager**: pnpm workspaces

## Key Features
1. **Booking CRUD** — create, view, update, delete bookings
2. **Thai UI** — all user-facing text in Thai, locale-aware date/currency formatting
3. **Room Management** — 5 rooms (ห้อง 01–05), conflict detection prevents double-booking (HTTP 409)
4. **Pricing Engine** — automatic calculation:
   - Daily: 600 THB/24h
   - Short-stay: 300 THB/3h; overtime 100 THB/h capped at daily rate
   - Extra guests: 100 THB/person/night beyond 2
5. **Timeline (Gantt) View** — /timeline: X-axis=hours, Y-axis=days×5 rooms; color-coded booking blocks; click empty slot to create booking; click block for details
6. **Dashboard** — summary stats (today's bookings, revenue, status counts), searchable/filterable table with room + duration columns
7. **Booking Detail** — full invoice with base price, overtime fee, extra bed fee, total

## Database Schema (bookings table)
- `id`, `room_id` (1–5), `guest_name`, `num_guests`
- `check_in_at`, `check_out_at`
- `package_type` ('daily' | 'short_stay')
- `payment_method` ('prepaid' | 'pay_at_counter')
- `status` ('pending' | 'paid' | 'checked_out')
- `base_price`, `overtime_fee`, `extra_bed_fee`, `total_price`, `overtime_hours`
- `notes`, `created_at`, `updated_at`

## API Endpoints
- `GET /api/bookings` — list bookings (query: roomId, startDate, endDate)
- `POST /api/bookings` — create booking (conflict detection)
- `GET /api/bookings/:id` — get booking
- `PATCH /api/bookings/:id` — update booking (recalculates pricing)
- `DELETE /api/bookings/:id` — delete booking
- `GET /api/bookings/summary` — dashboard stats

## Pricing Logic
Located in `artifacts/api-server/src/lib/pricing.ts` (backend) and `artifacts/booking-app/src/lib/utils-booking.ts` (frontend preview).

Both implementations must stay in sync.

## Codegen
Run from repo root: `pnpm --filter @workspace/api-spec run codegen`
Regenerates `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/`

## Timezone
All dates stored in UTC; displayed in Asia/Bangkok (GMT+7)

## Environment
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — session signing secret
- `PORT` — assigned by Replit per artifact
