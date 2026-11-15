-- MUST ERMS account personalisation and profile photo storage.
-- Applied to Supabase project axqknavghtqeyayglosr.

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists theme_preference text not null default 'system';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_theme_preference_check'
  ) then
    alter table public.profiles
      add constraint profiles_theme_preference_check
      check (theme_preference in ('light', 'dark', 'system'));
  end if;
end $$;

-- Preserve the existing column-level protection of role, account status,
-- institutional identifiers and department assignment.
grant update (avatar_path, theme_preference) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_insert_own_folder" on storage.objects;
create policy "profile_avatars_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile_avatars_update_own_folder" on storage.objects;
create policy "profile_avatars_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile_avatars_delete_own_folder" on storage.objects;
create policy "profile_avatars_delete_own_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
