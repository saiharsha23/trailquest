# Deployment
1. `npm install`, then `npm run build` and `npm run test`. Fix anything that fails before continuing.
2. Create a Supabase project. In the SQL editor run `supabase/all_in_one.sql` (or the five migrations in order). Run it once on a fresh project.
3. Authentication > Providers: enable **Anonymous sign-ins**. Authentication > URL Configuration: set Site URL to your Vercel URL and add `http://localhost:5173` as a redirect.
4. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings > API).
5. Create the admin user and provision it (see SECURITY.md).
6. `npm run dev`; sign in at `/admin`. Team Management > Create starter event, edit clues, set accepted answers.
7. Route Builder: generate and publish. Team Management: generate a join code per team.
8. Push to GitHub (`git init && git add . && git commit -m "TrailQuest" && git branch -M main && git remote add origin <your-repo-url> && git push -u origin main`; `.env` is git-ignored). In Vercel import the repo (Vite preset), add the two env vars, deploy. HTTPS is required for camera scanning.
9. QR Code Studio: print one card, scan it on a phone against the deployed site, then print the rest.
10. Monitor: start the game. Do a full rehearsal with a test team first, using Reset progress afterwards.
No Edge Functions are used; all server logic is in Postgres functions.
