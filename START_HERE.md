# START HERE — from this folder to a live competition

You need: a computer with **Node.js 18+** and **Git**, and free accounts at **GitHub**, **Supabase** and **Vercel**.

## Part 1 — Check it builds on your computer (10 min)
1. Unzip, open a terminal in the folder `trailquest-hostel-treasure-hunt`.
2. `npm install`  (creates `package-lock.json`; keep it)
3. `npm run build`  → must finish without errors. Then `npm run test` → must pass.
   If anything fails, copy the error text and send it to Claude before going further.

## Part 2 — Supabase (database) (10 min)
1. supabase.com → New project. Save the database password. Wait until it is ready.
2. Left menu **SQL Editor → New query**. Open `supabase/all_in_one.sql` here, copy ALL of it, paste, click **Run**. It must say "Success". Run it **only once** (running twice gives "already exists" errors; if you must retry, create a fresh project).
   (Later changes: the file is just migrations 0001–0006 joined together.)
3. **Authentication → Sign In / Providers → Anonymous sign-ins → Enable**. (Teams join without email; without this nobody can join.)
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key. Never use the `service_role` key anywhere in this app.

## Part 3 — Make yourself the organiser (3 min)
1. **Authentication → Users → Add user → Create new user**: your email + a strong password, tick "Auto Confirm User".
2. **SQL Editor** → run (use your email):
   `insert into admins(user_id) select id from auth.users where email='you@example.com';`

## Part 4 — Run it locally once (5 min)
1. `cp .env.example .env` and fill in:
   `VITE_SUPABASE_URL=` the Project URL, `VITE_SUPABASE_ANON_KEY=` the anon key.
2. `npm run dev`, open http://localhost:5173/admin, sign in. You should see the Overview page.

## Part 5 — GitHub (5 min)
1. github.com → New repository (private is fine), no README.
2. In the terminal: `git init`, `git add .`, `git commit -m "TrailQuest"`, `git branch -M main`, `git remote add origin <repo-url>`, `git push -u origin main`.
   (`.env` is ignored, so your keys are not uploaded.)

## Part 6 — Vercel (5 min)
1. vercel.com → Add New → Project → import the GitHub repo. Framework: Vite (auto).
2. **Environment Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env`). Deploy.
3. Copy your site URL (e.g. https://trailquest-xyz.vercel.app). It is HTTPS, which phone cameras need.
4. Back in Supabase: **Authentication → URL Configuration** → Site URL = your Vercel URL; add `http://localhost:5173` under Redirect URLs.

## Part 7 — Set up the hunt (on your deployed site, /admin) (30 min)
1. **Team Management** → "Create starter event" (4 teams: 9, 9, 10, 10 players, and 8 stations). Rename teams/colours if you wish.
2. **Clue Library** → edit each station: write your riddle (10–15 lines is fine), the accepted answers (comma separated), optional hint, success message, quote. Use ↑ ↓ to reorder, Preview to see the player view, untick Active for stations you don't want. **Save** each one.
3. **Game Settings**: event name, instructions, time limit (blank = none), points (0 = scoring off), penalties, bonus, hints on/off, victory message. Save.
4. **Route Builder** → set checkpoints per team (default 6) → Generate routes → check warnings → adjust with dropdowns/arrows if you like → **Publish routes**. Publishing again resets that team's progress.
5. **Team Management** → "New join code" for every team. Write down each code now (shown once). Give each team only its own code.
6. **QR Code Studio** → Print cards (or choose Save as PDF; tick "Background graphics"). Cut the cards. Each card is team-coloured and numbered; stick card N of a team at the station of that team's checkpoint N (the studio lists which station each card belongs to).

## Part 8 — Rehearsal (do not skip) (30 min)
Use two phones and your admin laptop, with a test setup.
1. Monitor → **Start game**.
2. Phone A: open your site `/play`, enter Team code → joined. Scan Team A's checkpoint 1 card (also try the phone's normal camera). Clue appears.
3. Try a wrong answer (should retry), then the right one with different capitals/spaces (should pass). Scan the checkpoint 3 card too early → must be refused. Scan Team B's card with Team A → must be refused.
4. Monitor: events appear live. Try **Pause** (teams can't progress) and **Resume**.
5. Finish all checkpoints on one team → victory screen with time. Check **Results**.
6. In Monitor use **Reset progress** for every team. Do not leave test data.
Anything unexpected → note it and tell Claude.

## Part 9 — Event day
1. Hand out join codes. Teams open your site on their phone → Team Login → code.
2. Monitor → **Start game** (the clock/time limit starts per team at first scan). Watch the feed.
3. Pause/Resume/End as needed. **Results → Export CSV** at the end.

## Troubleshooting
- "Database not connected": `.env`/Vercel variables missing or mistyped. After changing Vercel variables, Redeploy.
- Can't join a team: Anonymous sign-ins not enabled, or code typed wrong (codes are case-insensitive; rotate the code if lost).
- "Not an organiser": you skipped Part 3, step 2, or used a different email.
- Camera doesn't open: needs HTTPS (use the Vercel URL, not an IP); allow camera permission; use "Enter code manually".
- Cards don't scan: print larger/higher quality; QR is black on white and should be at least 4 cm.
- Printed cards stopped working: you re-published routes or used "New token". Reprint.
