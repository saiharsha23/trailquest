**First time? Read START_HERE.md — it has every step.**

# TrailQuest — Hostel Treasure Hunt
React + TypeScript + Vite + Tailwind, Supabase (Postgres, Auth, Realtime), deployable on Vercel. No Edge Functions: all server logic is Postgres functions with Row Level Security.

**Routes:** `/` landing · `/admin` organiser · `/play` teams.

## Quick start
1. `npm install` (commit the generated `package-lock.json`)
2. Create a Supabase project. In the SQL editor paste and run `supabase/all_in_one.sql` (same as migrations 0001–0006).
3. Authentication → Providers: enable **Anonymous sign-ins**.
4. `cp .env.example .env` and fill the two `VITE_` values (Project Settings → API; use the anon key only).
5. Create an admin user (Authentication → Users), then in SQL: `insert into admins(user_id) select id from auth.users where email='you@example.com';`
6. `npm run dev` → open `/admin`.
Scripts: `npm run dev | build | typecheck | test | preview`. See DEPLOYMENT.md (Vercel/GitHub) and SECURITY.md.

## Features
Landing page, organiser login, teams + hashed join codes, clue library (reorder/preview/duplicate), automatic + manual routes with crowding warnings, QR studio (A4 print/PDF/PNG/CSV, revoke/regenerate), team dashboard + scanner, answers with server-side matching, hints with penalty, time limit, scoring, live monitor with game controls, results + CSV.
## Not implemented
Per-player accounts, drag-and-drop route editing (arrow/dropdown controls instead), automated server-side security tests (use the rehearsal in START_HERE.md).
## Verification status
Written without network access: `npm install`, build, tests and the SQL were not executed by the author. Run `npm run typecheck && npm run build && npm run test` and a full rehearsal before the event.
