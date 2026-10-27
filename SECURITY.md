# Security notes
## What is enforced on the server (Postgres RLS and functions)
- Expected answers (`station_answers`), route tables, tokens and attempts have **admin-only** policies. Team browsers cannot select them.
- Teams read clues only through `scan_checkpoint` and `get_my_state`, which derive the team from `auth.uid()`, never from a submitted team ID.
- `submit_answer` checks game status, scan order, a per-checkpoint wrong-answer limit, and locks the progress row so double submits cannot complete a checkpoint twice.
- Admin functions call `require_admin()`; admin status comes from the `admins` table, not from the client.
- Join codes and QR tokens are stored as SHA-256 hashes. A join code is shown once when generated.
## Provisioning the first admin
Create the user in Supabase Auth (Dashboard > Authentication > Users), then run in the SQL editor:
`insert into admins(user_id) select id from auth.users where email='you@example.com';`
## Known limits (read these)
- **Plain QR tokens are stored** in `team_routes.qr_token_plain` (admin-only) so cards can be reprinted. A leaked admin session exposes them.
- **Anonymous sign-ins** mean anyone with a valid team code can join. Keep codes private; rotate a code to stop new joins (existing members stay, so remove rows from `team_members` if needed).
- Join-code rate limiting is per anonymous user; an attacker can create new anonymous users. Use long, random codes (the default is 8 hex characters) and add CAPTCHA in Supabase Auth if abuse is a concern.
- Invalid, revoked and out-of-order scans are rejected and logged in the monitor.
- The frontend route guard is only for usability. Real protection is RLS and the functions above.
- Never put the service-role key in `.env` or Vercel client variables. Only the anon key is used.
- Not independently audited. Test with real accounts before the event.
