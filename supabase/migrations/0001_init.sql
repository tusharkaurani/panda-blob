-- panda-blob initial schema
--
-- api_users: API consumer accounts created by the admin from the dashboard.
-- Each row's access_key gates read/write/delete access to that user's blobs
-- via the public API (?apiKey=... query param).
--
-- blobs: the actual JSON payloads, one row per blob, owned by exactly one
-- api_user.
--
-- Security model: RLS is enabled on both tables with NO policies attached
-- (default-deny). All application access goes through the server-side
-- Supabase client constructed with the service role key (see
-- lib/supabase-server.ts), which bypasses RLS entirely by design. RLS here
-- is only a defense-in-depth backstop in case the anon/publishable key is
-- ever used against these tables by mistake — it should keep returning zero
-- rows. Do NOT add "USING (true)" policies to these tables.

create extension if not exists pgcrypto;

create table if not exists api_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_key text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists api_users_access_key_idx on api_users (access_key);

create table if not exists blobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references api_users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blobs_owner_id_idx on blobs (owner_id);
create index if not exists blobs_owner_created_idx on blobs (owner_id, created_at desc);

-- keep updated_at current on every row update
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on api_users;
create trigger set_updated_at
  before update on api_users
  for each row
  execute function set_updated_at();

drop trigger if exists set_updated_at on blobs;
create trigger set_updated_at
  before update on blobs
  for each row
  execute function set_updated_at();

-- Default-deny RLS (see note above) — no policies created on purpose.
alter table api_users enable row level security;
alter table blobs enable row level security;
