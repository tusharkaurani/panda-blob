# pandablob

A jsonblob.com-style JSON storage service with a public CRUD API and an admin dashboard, built on Next.js + Supabase, deployed on Vercel.

## How it works

- **Users** are API consumer accounts (e.g. "project-foo"), created only through the admin dashboard. Each one gets an auto-generated **access key**.
- Every **blob** belongs to exactly one User. The public API requires that User's access key (`?apiKey=...` query param) to read/write/delete a blob.
- The **Admin** (you) logs into the dashboard via Supabase Auth to manage Users and Blobs. Sign-in and sign-out both happen through server-side routes (`/api/auth/login`, `/api/auth/logout`) rather than a client-side Supabase call, so no Supabase key of any kind is ever included in the browser JS bundle — not even the publishable key.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com).

3. **Apply the database migration** with the Supabase CLI. This repo is already a Supabase CLI project (`supabase/config.toml` + `supabase/migrations/`), so:
   ```
   npx supabase login                                    # opens your browser to authorize
   npx supabase link --project-ref <your-project-ref>    # prompts for your DB password
   npx supabase db push                                  # runs supabase/migrations/*.sql
   ```
   Your project ref is the subdomain of your project URL (e.g. `rjuccjrvcewaxottaurq` in `https://rjuccjrvcewaxottaurq.supabase.co`). The DB password is under Project Settings > Database (reset it there if you don't have it — it's separate from the API keys below). Add every future schema change as a new file under `supabase/migrations/` and re-run `npx supabase db push`.

   > Note: Supabase's dashboard **GitHub integration** is for preview branches on PRs, not automatic production migrations — connecting it does **not** run these migrations on push to `main`. `supabase db push` is the mechanism this project relies on.

4. **Create the one admin account**: in the Supabase dashboard, go to Authentication > Users and manually create a user (email/password). There is no signup page in the app — this is the only account that can log into the dashboard. Disable public signups in Authentication > Settings.

5. **Configure environment variables**: copy `.env.example` to `.env.local` and fill in the three values, all on the same Settings > API page in the Supabase dashboard — project URL, publishable key, and secret key. (The publishable and secret keys are deliberately separate credentials with different privilege levels — publishable is safe to expose in the browser, secret bypasses RLS and must stay server-only — so they can't be collapsed into one.)

6. **Run locally**
   ```
   npm run dev
   ```
   Visit `http://localhost:3000` — it redirects to `/users`, which redirects to `/login` until you sign in.

## Public API

Base path `/api/blob`. Every request needs an `apiKey` query parameter (a User's access key, created from the admin dashboard).

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/blob?apiKey=<key>` | Create a blob. Body = any JSON. Returns `201` with a `Location` header and the created JSON. |
| `GET` | `/api/blob/{id}?apiKey=<key>` | Fetch a blob's raw JSON. |
| `PUT` | `/api/blob/{id}?apiKey=<key>` | Full replace of a blob's JSON. |
| `DELETE` | `/api/blob/{id}?apiKey=<key>` | Delete a blob. |

Errors: `401` for a missing/invalid/disabled key, `404` for a blob that doesn't exist or belongs to a different User, `400` for malformed JSON or an invalid blob id.

```
curl -X POST "https://your-deployment.vercel.app/api/blob?apiKey=<key>" -d '{"hello":"world"}'
curl "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>"
curl -X PUT "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>" -d '{"hello":"updated"}'
curl -X DELETE "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>"
```

## Admin dashboard

- `/users` — list, search, and create Users; copy/regenerate/disable/delete their access keys.
- `/users/[id]` — a User's details and its blobs; create blobs on its behalf.
- `/blobs` — every blob across all Users, searchable by blob id or owner name.
- `/blobs/[id]` — edit or delete a single blob's JSON.

## Deploying to Vercel

Set these environment variables in the Vercel project settings (same values as `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — project URL and publishable key, safe to expose in the browser (though nothing in the client bundle currently uses them — see above). The project URL is reused server-side too, so there's no separate server-only URL var.
- `SUPABASE_SECRET_KEY` — server-only secret, bypasses RLS, never exposed to the browser.
- `ADMIN_EMAIL` (optional) — restricts dashboard access to this exact Supabase Auth email even if another account somehow exists.

Then push to the connected Git branch (or `vercel deploy`) — Next.js is auto-detected, no `vercel.json` needed.

Database migrations are **not** tied to the Vercel deploy. When a change adds a new file under `supabase/migrations/`, apply it with `npx supabase db push` (see Setup step 3) — do this before or alongside the deploy that depends on the new schema.
