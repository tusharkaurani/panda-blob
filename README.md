# pandablob

A [jsonblob.com](https://jsonblob.com)-style JSON storage service: a public CRUD API that other projects call programmatically, plus an admin dashboard to manage it all. Built on Next.js (App Router) + Supabase, deployed on Vercel.

## The model

There are three concepts:

- **Users** — API consumer accounts (e.g. `project-foo`), one per project/service that stores blobs. Created *only* from the admin dashboard; there is no self-serve signup. Each User has an auto-generated **access key**.
- **Blobs** — arbitrary JSON documents. Every blob belongs to exactly one User.
- **Admin** — you. Logs into the dashboard to create Users, hand out access keys, and browse/edit blobs.

So there are two completely separate kinds of "auth" in this app, described next.

## Authentication

### 1. Public API — per-User access keys

Every call to the public blob API must carry a User's access key as a query param (`?apiKey=<key>`). The key identifies the owning User, and a blob can only be read or written with *its own owner's* key. No key, wrong key, or a disabled User's key → rejected. Keys are created, viewed, and regenerated from the admin dashboard.

Keys are stored in plaintext in the database (the admin needs to view them persistently, which rules out hashing). They're safe because they're high-entropy (`pb_` + 32 random bytes) and the table holding them is never exposed to the browser — only server-side code using the secret key touches it.

### 2. Admin dashboard — Supabase Auth

The dashboard is gated by **Supabase Auth**. We don't build any login logic ourselves — Supabase hosts the user store, hashes passwords, and issues session tokens. Our app just:

- posts credentials to a server-side route (`/api/auth/login` → `supabase.auth.signInWithPassword`), so **no Supabase key ever ships in the browser bundle**;
- checks the resulting session cookie in [`proxy.ts`](proxy.ts) on every `/(dashboard)` and `/api/admin/*` request, redirecting to `/login` when it's missing.

**There is exactly one admin account, and you create it by hand** (Setup step 4) — the app has no signup page.

> **Important — locking it down.** The app has no signup page, but Supabase Auth's signup *endpoint* lives on your project domain and is reachable directly (`POST https://<ref>.supabase.co/auth/v1/signup`), independent of our UI. And `proxy.ts` treats *any* valid Supabase session as the admin. So without the two locks below, a stranger could self-register against that raw endpoint and walk into your dashboard:
> 1. **Disable public signups** in the Supabase dashboard (Authentication → Sign In / Providers) — closes the endpoint so no new accounts can be minted.
> 2. **Set `ADMIN_EMAIL`** (env var) to your admin's exact email — even if an account is somehow created, only that email passes the admin check.
>
> Do both.

### Row-Level Security

Both tables (`api_users`, `blobs`) have RLS enabled with **no policies** (default-deny). All app access goes through the server-side client using the **secret key**, which bypasses RLS by design. RLS is a backstop: if the publishable key were ever pointed at these tables, it gets zero rows.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com). Note its **project ref** — the subdomain of the project URL (e.g. `rjuccjrvcewaxottaurq` in `https://rjuccjrvcewaxottaurq.supabase.co`).

3. **Apply the database migration** with the Supabase CLI. This repo is already a Supabase CLI project (`supabase/config.toml` + `supabase/migrations/`):
   ```
   npx supabase login                                 # opens your browser to authorize
   npx supabase link --project-ref <your-project-ref> # prompts for your DB password
   npx supabase db push                               # runs supabase/migrations/*.sql
   ```
   The DB password is under Project Settings → Database (reset it there if you don't have it — it's separate from the API keys in step 5). For future schema changes, add a new file under `supabase/migrations/` and re-run `npx supabase db push`.

   > Supabase's dashboard **GitHub integration** is for PR preview branches, *not* automatic production migrations — connecting it does **not** run these migrations on push to `main`. `supabase db push` is the mechanism this project relies on.

4. **Create your admin account** (see [Authentication](#2-admin-dashboard--supabase-auth) above for why this is manual):
   - Authentication → Users → **Add user** → set your email and password, and check **Auto Confirm User**.
   - Authentication → Sign In / Providers → **turn off public signups**.

5. **Configure environment variables.** Copy `.env.example` to `.env.local` and fill it in. The first three come from Project Settings → API in the Supabase dashboard:

   | Variable | What | Exposure |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | used server- and client-side |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key | browser-safe (not actually shipped to the client here, but Supabase's auth endpoint expects it) |
   | `SUPABASE_SECRET_KEY` | Secret key — bypasses RLS | **server-only, never expose** |
   | `ADMIN_EMAIL` | Your admin email (from step 4) | server-only; strongly recommended (see lock #2 above) |

   The publishable and secret keys are deliberately separate credentials at different privilege levels — they can't be collapsed into one.

6. **Run locally**
   ```
   npm run dev
   ```
   Visit `http://localhost:3000`. It redirects to `/users`, which redirects to `/login` until you sign in with the admin account from step 4.

## Public API

Base path `/api/blob`. Every request needs the owning User's access key as an `apiKey` query param.

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/blob?apiKey=<key>` | Create a blob. Body = any JSON. Returns `201` + a `Location` header + the created JSON. |
| `GET` | `/api/blob/{id}?apiKey=<key>` | Fetch a blob's raw JSON. |
| `PUT` | `/api/blob/{id}?apiKey=<key>` | Full replace of a blob's JSON. |
| `DELETE` | `/api/blob/{id}?apiKey=<key>` | Delete a blob. |

Errors: `401` for a missing / invalid / disabled key, `404` for a blob that doesn't exist *or* belongs to a different User (indistinguishable on purpose), `400` for malformed JSON or an invalid blob id.

```
curl -X POST "https://your-deployment.vercel.app/api/blob?apiKey=<key>" -d '{"hello":"world"}'
curl "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>"
curl -X PUT "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>" -d '{"hello":"updated"}'
curl -X DELETE "https://your-deployment.vercel.app/api/blob/<id>?apiKey=<key>"
```

## Admin dashboard

- `/users` — list, search, and create Users; copy / regenerate / disable / delete access keys.
- `/users/[id]` — a User's details and its blobs; create blobs on its behalf.
- `/blobs` — every blob across all Users, searchable by blob id or owner name.
- `/blobs/[id]` — edit or delete a single blob's JSON.

All lists paginate at 10 rows per page.

## Deploying to Vercel

Set the same variables from Setup step 5 in the Vercel project settings (Settings → Environment Variables), then push to the connected Git branch (or `vercel deploy`). Next.js is auto-detected — no `vercel.json` needed.

Also confirm your Supabase Auth **redirect / site URLs** (Authentication → URL Configuration) include the deployed domain.

Database migrations are **not** tied to the Vercel deploy. When a change adds a file under `supabase/migrations/`, apply it with `npx supabase db push` (Setup step 3) before or alongside the deploy that needs it.
