# panda-blob

A self-hosted JSON storage service in the spirit of [jsonblob.com](https://jsonblob.com): a small public CRUD API that your other projects call programmatically, plus an admin dashboard to issue keys and browse the data.

Built with Next.js (App Router), Supabase, and TypeScript. Runs on Vercel or as a Docker container.

- **Public API** — create, read, replace, and delete JSON documents with a single API key.
- **Admin dashboard** — manage API consumers, rotate keys, and edit blobs in a JSON editor.
- **Single-admin by design** — Supabase Auth with optional TOTP two-factor; no self-serve signup.
- **Defense in depth** — default-deny row-level security, server-only secrets, constant-time secret comparison.

## Concepts

| Concept | What it is |
|---|---|
| **App** | An API consumer account (e.g. `project-foo`), one per project that stores blobs. Each App owns an auto-generated access key. Apps are created only from the dashboard. |
| **Blob** | An arbitrary JSON document. Every blob belongs to exactly one App. |
| **Admin** | You. Signs into the dashboard to create Apps, hand out keys, and manage blobs. |

An App's key can only reach that App's blobs, so projects sharing one deployment stay isolated from each other.

## Quick start

### Docker

Images are published to both Docker Hub and GHCR on every push to `main`, for `linux/amd64` and `linux/arm64`.

```bash
docker run -d --name panda-blob -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  -e SUPABASE_SECRET_KEY="<secret-key>" \
  -e ADMIN_EMAIL="you@example.com" \
  dockerpanda1206/panda-blob:latest
```

```bash
# or from GitHub Container Registry
docker run -d -p 3000:3000 --env-file .env.local ghcr.io/tusharkaurani/panda-blob:latest
```

Tags: `latest` and the commit SHA. The image contains no secrets — every variable is read at request time, so all configuration is supplied at `docker run`.

You still need a Supabase project behind it; see [Setup](#setup).

### From source

```bash
npm install
cp .env.example .env.local   # fill in the values from Setup
npm run dev
```

Visit `http://localhost:3000`, which redirects to the dashboard (and to `/login` until you sign in).

## Setup

**1. Create a Supabase project** at [supabase.com](https://supabase.com). Note the **project ref** — the subdomain of your project URL (`abcdefghijklmnop` in `https://abcdefghijklmnop.supabase.co`).

**2. Apply the database migration.** This repo is already a Supabase CLI project (`supabase/config.toml` + `supabase/migrations/`):

```bash
npx supabase login                                  # authorize in your browser
npx supabase link --project-ref <your-project-ref>  # prompts for your DB password
npx supabase db push                                # runs supabase/migrations/*.sql
```

The DB password lives under Project Settings → Database and is separate from your API keys. For later schema changes, add a file to `supabase/migrations/` and re-run `db push`.

> Supabase's GitHub integration creates PR preview branches — it does **not** run migrations on push to `main`. `supabase db push` is the mechanism this project relies on.

**3. Create your admin account.** The app has no signup page, so add the user by hand:

- Authentication → Users → **Add user** — set your email and password, and check **Auto Confirm User**.
- Authentication → Sign In / Providers → **turn off public signups**.

**4. Configure environment variables.** Copy `.env.example` to `.env.local` and fill it in. The first three are on Project Settings → API in the Supabase dashboard.

| Variable | Purpose | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Server and client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key, used by Supabase's auth endpoint | Browser-safe |
| `SUPABASE_SECRET_KEY` | Secret key; bypasses RLS | **Server only — never expose** |
| `ADMIN_EMAIL` | The one email allowed into the dashboard | Server only; strongly recommended |
| `ADMIN_API_SECRET` | Shared secret for `GET /api/stats`. Unset disables the route. | Server only; optional |

The publishable and secret keys are separate credentials at different privilege levels and cannot be collapsed into one. Generate `ADMIN_API_SECRET` with `openssl rand -hex 32`.

> **Lock down your Supabase project.** Supabase Auth's signup *endpoint* is reachable on your project domain (`POST https://<ref>.supabase.co/auth/v1/signup`) whether or not your UI offers signup. Do both of the following: **disable public signups** (step 3) so no account can be minted, and **set `ADMIN_EMAIL`** so that even if one is, only your address passes the admin check.

## Public API

Base path `/api/blob`. Every request carries the owning App's access key as an `apiKey` query parameter.

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/blob?apiKey=<key>` | Create a blob from the JSON body. Returns `201` with a `Location` header and the stored JSON. |
| `GET` | `/api/blob/{id}?apiKey=<key>` | Return the blob's raw JSON. |
| `PUT` | `/api/blob/{id}?apiKey=<key>` | Replace the blob's JSON entirely. |
| `DELETE` | `/api/blob/{id}?apiKey=<key>` | Delete the blob. Returns `204`. |

```bash
curl -X POST "https://your-deployment.example.com/api/blob?apiKey=$KEY" -d '{"hello":"world"}'
curl "https://your-deployment.example.com/api/blob/$ID?apiKey=$KEY"
curl -X PUT "https://your-deployment.example.com/api/blob/$ID?apiKey=$KEY" -d '{"hello":"updated"}'
curl -X DELETE "https://your-deployment.example.com/api/blob/$ID?apiKey=$KEY"
```

| Status | Meaning |
|---|---|
| `400` | Malformed JSON body, or a blob id that isn't a UUID |
| `401` | Missing, invalid, or disabled API key |
| `404` | Blob does not exist, or belongs to another App (deliberately indistinguishable) |
| `413` | Body larger than 3 MB |

### Stats endpoint

`GET /api/stats?secret=<ADMIN_API_SECRET>` returns aggregate counts — `{ "totalApps": n, "totalBlobs": n }` — for external consumers such as a status widget that can't hold a browser session. It exposes no App or blob content. The secret is compared in constant time, and the route returns `503` when `ADMIN_API_SECRET` is unset.

## Admin dashboard

| Route | Purpose |
|---|---|
| `/apps` | List, search, and create Apps; copy, regenerate, disable, or delete access keys |
| `/apps/[id]` | An App's details and blobs; create blobs on its behalf |
| `/blobs` | Every blob across all Apps, searchable by id or owner |
| `/blobs/[id]` | Edit or delete a blob's JSON |
| `/docs` | The public API reference, with your deployment's base URL filled in |
| `/settings` | Enroll or remove an authenticator app for two-factor sign-in |

Lists paginate at 10 rows per page.

## Security model

**Two independent kinds of auth.** The public API authenticates *Apps* by access key. The dashboard authenticates *you* through Supabase Auth. They share no code paths.

**Access keys** are `pb_` plus 32 random bytes and stored in plaintext, because the dashboard must display them after creation. They stay safe because the `apps` table is never reachable from the browser — only server-side code holding the secret key queries it.

**Dashboard sessions** are issued by Supabase Auth: it hosts the user store, hashes passwords, and mints tokens. Credentials are posted to a server-side route (`/api/auth/login`), so no Supabase key ships in the browser bundle. `proxy.ts` checks the session cookie on every dashboard and `/api/admin/*` request, and each admin route handler re-checks independently rather than trusting the middleware alone.

**Two-factor authentication** is optional and TOTP-based. Once a factor is verified, a session that hasn't stepped up to `aal2` is redirected to `/login/mfa` and treated as unauthenticated everywhere else. AAL checks fail closed.

**Row-level security** is enabled on both tables with no policies at all (default-deny). Application access goes through the secret key, which bypasses RLS by design; RLS is the backstop that returns zero rows if the publishable key is ever pointed at these tables.

## Deployment

### Vercel

Set the same variables from Setup step 4 under Settings → Environment Variables, then push to the connected branch (or run `vercel deploy`). Next.js is auto-detected — no `vercel.json` needed. Add your deployed domain to Supabase's Authentication → URL Configuration.

### Docker

`Dockerfile` produces a multi-stage standalone build that runs as a non-root user on port 3000. `.github/workflows/docker-publish.yml` builds and pushes multi-arch images to Docker Hub and GHCR on every push to `main`, and syncs this README to the Docker Hub description.

Migrations are **not** part of any deploy. When a change adds a file under `supabase/migrations/`, apply it with `npx supabase db push` before or alongside the deploy that needs it.

## Development

```bash
npm run dev            # start the dev server
npm run build          # production build
npm test               # run the test suite (Vitest)
npm run test:watch     # watch mode
npm run test:coverage  # coverage report to coverage/
npm run lint           # lint
```

Requires Node.js 20.9 or newer. Tests run on every push and pull request against `main` via `.github/workflows/test.yml`.
