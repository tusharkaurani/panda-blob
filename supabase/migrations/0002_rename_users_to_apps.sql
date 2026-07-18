-- Rename the User concept to App.
--
-- api_users -> apps: this table was always "the thing that holds an access
-- key and owns blobs" rather than a human user account (there is exactly
-- one human, the admin, who authenticates separately via Supabase Auth --
-- see lib/auth.ts). Renaming to `apps` avoids overloading "user" once a
-- real multi-user layer is ever added on top.
--
-- blobs.owner_id -> blobs.app_id: follows the same rename.
--
-- Pure rename, no data changes.

alter table api_users rename to apps;
alter table apps rename constraint api_users_pkey to apps_pkey;
alter index api_users_access_key_idx rename to apps_access_key_idx;

alter table blobs rename column owner_id to app_id;
alter table blobs rename constraint blobs_owner_id_fkey to blobs_app_id_fkey;
alter index blobs_owner_id_idx rename to blobs_app_id_idx;
alter index blobs_owner_created_idx rename to blobs_app_created_idx;
