-- ============================================================
-- Original VeriSync base schema — NEW DATABASE bootstrap only.
-- Always apply scanin_migration.sql afterward. Never rerun this on a migrated database.
--
-- This file replaces the old schema.sql + AdminRole.sql +
-- AdminPolicies.sql + AdminFunction.sql + AdminCode1.sql files.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard -> SQL Editor
--   2. Paste the ENTIRE file
--   3. Click "Run"
--   4. Then run Supabase/seed_admin.sql to promote an admin account
--
-- This script is IDEMPOTENT: it can be run multiple times safely.
--
-- Roles:       student | teacher | administrator
-- Approval:    student = approved on signup, teacher = pending
--              (an administrator must approve teachers)
--
-- NOTE: tables/columns are created FIRST, then functions, then
-- policies — because the functions and policies reference columns
-- that must already exist.
-- ============================================================

-- ============================================================
-- SECTION 0 — TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 0.1 PROFILES TABLE
-- One row per auth user. Role and approval status live here.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student',
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migrations for existing databases.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists status text not null default 'approved';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'administrator'));

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- 0.2 EVENTS TABLE
-- event_code is the public identifier embedded in the QR code.
-- ------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  venue text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists status text not null default 'open';
alter table public.events add column if not exists updated_at timestamptz not null default now();

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('draft', 'open', 'closed'));

alter table public.events enable row level security;

create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists events_status_idx on public.events (status);

-- ------------------------------------------------------------
-- 0.3 ATTENDANCE TABLE
-- One row per student scanning one event.
-- ------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null default 'present',
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

alter table public.attendance add column if not exists status text not null default 'present';

alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'absent'));

alter table public.attendance enable row level security;

create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists attendance_event_id_idx on public.attendance (event_id);

-- ------------------------------------------------------------
-- 0.4 STUDENT PROFILES TABLE
-- Extra student-only details (ID number, course, year, block, gender, age, email, phone).
-- ------------------------------------------------------------
create table if not exists public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  student_id_no text not null,
  course_year text,
  course text,
  block text,
  gender text,
  age integer,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive migrations for existing databases.
alter table public.student_profiles add column if not exists course_year text;
alter table public.student_profiles add column if not exists course text;
alter table public.student_profiles add column if not exists block text;
alter table public.student_profiles add column if not exists gender text;
alter table public.student_profiles add column if not exists age integer;
alter table public.student_profiles add column if not exists email text;
alter table public.student_profiles add column if not exists phone text;
alter table public.student_profiles drop column if exists birthday;
alter table public.student_profiles drop column if exists id_valid_until;

alter table public.student_profiles enable row level security;

-- ============================================================
-- SECTION 1 — FUNCTIONS
-- ============================================================

-- Returns true when the current user is an approved administrator.
create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'administrator'
  );
$$;

-- Returns true when the current user is an approved student.
create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
      and status = 'approved'
  );
$$;

-- Returns true when the current user is an approved teacher or admin.
create or replace function public.can_manage_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('teacher', 'administrator')
      and status = 'approved'
  );
$$;

-- Returns true when the current user created the given event.
create or replace function public.owns_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events
    where id = p_event_id
      and created_by = auth.uid()
  );
$$;

-- Shared updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Block self-service role/status escalation. Only admins may change these.
create or replace function public.prevent_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL Editor / service role, which is
  -- trusted (e.g. running Supabase/seed_admin.sql), so allow it.
  if (new.role is distinct from old.role
      or new.status is distinct from old.status)
     and auth.uid() is not null
     and not public.is_administrator() then
    raise exception 'Only administrators can change role or status';
  end if;
  return new;
end;
$$;

-- Lock student details once they are complete. Students may fill in and
-- correct their details until every required field is present; after that
-- the record becomes permanent (attendance integrity). Admins and the
-- service role (SQL Editor / seed scripts) can still make corrections.
create or replace function public.prevent_student_profile_edit_when_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL Editor / service role, which is
  -- trusted (e.g. running Supabase/seed_admin.sql), so allow it.
  if auth.uid() is null or public.is_administrator() then
    return new;
  end if;

  if old.student_id_no <> ''
     and old.course_year is not null
     and old.course is not null
     and old.block is not null
     and old.gender is not null
     and old.email is not null
     and old.phone is not null then
    raise exception 'Student details are locked once complete. Contact an administrator to make changes.';
  end if;

  return new;
end;
$$;

-- Automatically create a profile after a user signs up.
-- full_name and role come from signUp() options.data metadata.
-- Teachers start as 'pending'; students are 'approved'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := case
    when new.raw_user_meta_data->>'role' in ('student', 'teacher')
      then new.raw_user_meta_data->>'role'
    else 'student'
  end;

  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    v_role,
    case when v_role = 'teacher' then 'pending' else 'approved' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

grant execute on function public.is_administrator() to authenticated, anon;
grant execute on function public.can_manage_events() to authenticated, anon;
grant execute on function public.owns_event(uuid) to authenticated, anon;

-- ============================================================
-- SECTION 2 — TRIGGERS
-- ============================================================

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists prevent_profile_escalation on public.profiles;
create trigger prevent_profile_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_escalation();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute procedure public.set_updated_at();

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists prevent_student_profile_edit_when_complete on public.student_profiles;
create trigger prevent_student_profile_edit_when_complete
  before update on public.student_profiles
  for each row execute procedure public.prevent_student_profile_edit_when_complete();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SECTION 3 — ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 PROFILES
-- ------------------------------------------------------------
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_administrator());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_administrator())
  with check (public.is_administrator());

-- Teachers can read the profiles of students who attended their events.
drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id
        and e.created_by = auth.uid()
    )
  );

-- Anyone can read the profile of an event creator (to show "Created by").
drop policy if exists "Event creators are publicly viewable" on public.profiles;
create policy "Event creators are publicly viewable"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.events e
      where e.created_by = profiles.id
    )
  );

-- ------------------------------------------------------------
-- 3.2 EVENTS
-- ------------------------------------------------------------
-- Any signed-in user can read events (needed to validate QR + browse).
drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (auth.role() = 'authenticated');

-- Only approved teachers/admins can create events.
drop policy if exists "Teachers and admins can insert events" on public.events;
create policy "Teachers and admins can insert events"
  on public.events for insert
  with check (public.can_manage_events());

-- The creator (or an admin) can update their events.
drop policy if exists "Creator or admin can update events" on public.events;
create policy "Creator or admin can update events"
  on public.events for update
  using (auth.uid() = created_by or public.is_administrator())
  with check (auth.uid() = created_by or public.is_administrator());

-- The creator (or an admin) can delete their events.
drop policy if exists "Creator or admin can delete events" on public.events;
create policy "Creator or admin can delete events"
  on public.events for delete
  using (auth.uid() = created_by or public.is_administrator());

-- ------------------------------------------------------------
-- 3.3 ATTENDANCE
-- ------------------------------------------------------------
drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance"
  on public.attendance for select
  using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (auth.uid() = student_id and public.is_student());

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (public.owns_event(event_id));

drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  using (public.is_administrator());

-- Correcting records: event creator or admin can update/delete.
drop policy if exists "Creator or admin can update attendance" on public.attendance;
create policy "Creator or admin can update attendance"
  on public.attendance for update
  using (public.owns_event(event_id) or public.is_administrator())
  with check (public.owns_event(event_id) or public.is_administrator());

drop policy if exists "Creator or admin can delete attendance" on public.attendance;
create policy "Creator or admin can delete attendance"
  on public.attendance for delete
  using (public.owns_event(event_id) or public.is_administrator());

-- ------------------------------------------------------------
-- 3.4 STUDENT PROFILES
-- ------------------------------------------------------------
drop policy if exists "Students can view their own details" on public.student_profiles;
create policy "Students can view their own details"
  on public.student_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert their own details" on public.student_profiles;
create policy "Students can insert their own details"
  on public.student_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can update their own details" on public.student_profiles;
create policy "Students can update their own details"
  on public.student_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage all student details" on public.student_profiles;
create policy "Admins can manage all student details"
  on public.student_profiles for all
  using (public.is_administrator())
  with check (public.is_administrator());

-- Teachers can read the details of students who attended their events.
drop policy if exists "Teachers can view details of their attendees" on public.student_profiles;
create policy "Teachers can view details of their attendees"
  on public.student_profiles for select
  using (
    exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = student_profiles.user_id
        and e.created_by = auth.uid()
    )
  );

-- ============================================================
-- SECTION 4 — REALTIME
-- Publish attendance + events so clients can subscribe to changes.
-- ============================================================
alter table public.attendance replica identity full;
alter table public.events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end
$$;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
