-- ScanIn additive migration. Back up the database first. Run AFTER the original schema.
-- All app writes use narrowly scoped RPCs. Never expose the service-role key in Expo.
begin;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.profiles add column if not exists status_reason text;
alter table public.profiles add column if not exists reminder_start boolean not null default true;
alter table public.profiles add column if not exists reminder_end boolean not null default true;
alter table public.events add column if not exists required boolean not null default false;
alter table public.events add column if not exists audience_course text;
alter table public.events add column if not exists audience_year text;
alter table public.events add column if not exists audience_block text;
alter table public.events add column if not exists late_minutes integer not null default 15;
alter table public.events add column if not exists archived boolean not null default false;
alter table public.events add column if not exists cancel_reason text;
alter table public.events add column if not exists roster_frozen boolean not null default false;
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check(status in ('draft','open','closed','cancelled'));
alter table public.events drop constraint if exists scanin_late_check;
alter table public.events add constraint scanin_late_check check(late_minutes between 0 and 1440);
alter table public.attendance alter column scanned_at drop not null;
alter table public.attendance add column if not exists source text not null default 'qr';
alter table public.attendance add column if not exists corrected_at timestamptz;
alter table public.attendance add column if not exists correction_reason text;
create table if not exists public.event_audience(event_id uuid references public.events(id) on delete cascade,student_id uuid references public.profiles(id),primary key(event_id,student_id));
create table if not exists public.saved_events(event_id uuid references public.events(id) on delete cascade,student_id uuid references public.profiles(id),primary key(event_id,student_id));
create table if not exists public.requests(
 id uuid primary key default gen_random_uuid(),requester_id uuid not null references public.profiles(id),kind text not null check(kind in ('profile','attendance','event')),
 event_id uuid references public.events(id),student_id uuid references public.profiles(id),payload jsonb not null default '{}',reason text not null,attachment text,
 status text not null default 'pending' check(status in ('pending','resolved','declined')),response text,reviewed_by uuid references public.profiles(id),created_at timestamptz not null default now(),reviewed_at timestamptz);
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),title text not null,body text not null,event_id uuid references public.events(id),request_id uuid references public.requests(id),
 dedupe_key text not null unique,read_at timestamptz,created_at timestamptz not null default now(),push_sent boolean not null default false,push_error text);
create table if not exists public.push_tokens(user_id uuid references public.profiles(id),token text primary key,updated_at timestamptz not null default now());
create table if not exists public.audit_log(id bigint generated always as identity primary key,actor_id uuid,action text not null,record_type text not null,record_id text,old_value jsonb,new_value jsonb,reason text,created_at timestamptz not null default now());
create table if not exists public.system_settings(id integer primary key default 1 check(id=1),courses text[] not null default array['BSIT','BSHM','BSED','BPED','BEED','BSENTREP'],years text[] not null default array['FIRST YEAR','SECOND YEAR','THIRD YEAR','FOURTH YEAR'],blocks text[] not null default array['A','B','C','D','E','F'],late_minutes integer not null default 15 check(late_minutes between 0 and 1440),reminder_start_minutes integer not null default 30 check(reminder_start_minutes between 1 and 1440),reminder_end_minutes integer not null default 10 check(reminder_end_minutes between 1 and 1440));
insert into public.system_settings(id) values(1) on conflict do nothing;
create index if not exists event_audience_student_idx on public.event_audience(student_id);
create index if not exists notifications_user_idx on public.notifications(user_id,created_at desc);
create index if not exists requests_pending_idx on public.requests(status,created_at);

create or replace function public.scanin_active() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and status='approved' and not suspended)$$;
create or replace function public.is_administrator() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='administrator' and status='approved' and not suspended)$$;
create or replace function public.is_student() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='student' and status='approved' and not suspended)$$;
create or replace function public.can_manage_events() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role in ('teacher','administrator') and status='approved' and not suspended)$$;
create or replace function public.owns_event(p_event_id uuid) returns boolean language sql stable security definer set search_path=public as $$select public.can_manage_events() and exists(select 1 from events where id=p_event_id and created_by=auth.uid())$$;
create or replace function public.scanin_event_access(eid uuid) returns boolean language sql stable security definer set search_path=public as $$select scanin_active() and (is_administrator() or owns_event(eid) or exists(select 1 from event_audience where event_id=eid and student_id=auth.uid()))$$;
create or replace function public.scanin_person_access(pid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select pid=auth.uid() or is_administrator() or (scanin_active() and exists(select 1 from event_audience a join events e on e.id=a.event_id where a.student_id=pid and e.created_by=auth.uid()) and can_manage_events()) or (scanin_active() and exists(select 1 from events e join event_audience a on a.event_id=e.id where e.created_by=pid and a.student_id=auth.uid()));$$;
create or replace function public.scanin_complete(pid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from student_profiles s where s.user_id=pid and nullif(trim(s.student_id_no),'') is not null and nullif(trim(s.course),'') is not null and nullif(trim(s.course_year),'') is not null and nullif(trim(s.block),'') is not null and nullif(trim(s.gender),'') is not null and nullif(trim(s.email),'') is not null and nullif(trim(s.phone),'') is not null)$$;
-- Replace the old escalation rule. App users, including admin, cannot change roles directly.
create or replace function public.prevent_profile_escalation() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is not null and (new.role is distinct from old.role or new.status is distinct from old.status or new.suspended is distinct from old.suspended or new.status_reason is distinct from old.status_reason) then raise exception 'Use the approved account-management workflow';end if;
 return new;end $$;
-- Only controlled RPCs write profiles; the account RPC uses its own validation and a scoped setting.
create or replace function public.scanin_profile_guard() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is not null and new.role is distinct from old.role then raise exception 'Roles cannot be changed in the app';end if;
 if auth.uid() is not null and (new.status is distinct from old.status or new.suspended is distinct from old.suspended or new.status_reason is distinct from old.status_reason) and not is_administrator() then raise exception 'Administrator access required';end if;
 return new;end $$;
drop trigger if exists prevent_profile_escalation on public.profiles;
create trigger prevent_profile_escalation before update on public.profiles for each row execute function public.scanin_profile_guard();

-- Replace legacy policies to remove permissive direct attendance writes and recursive joins.
do $$declare t text;p record;begin foreach t in array array['profiles','student_profiles','events','attendance','event_audience','saved_events','requests','notifications','push_tokens','audit_log','system_settings'] loop
 execute format('alter table public.%I enable row level security',t);
 for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t);end loop;
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;end $$;
create policy scanin_profiles_read on public.profiles for select to authenticated using(scanin_person_access(id));
create policy scanin_details_read on public.student_profiles for select to authenticated using(scanin_person_access(user_id));
create policy scanin_details_insert on public.student_profiles for insert to authenticated with check(user_id=auth.uid() and is_student());
create policy scanin_details_update on public.student_profiles for update to authenticated using(user_id=auth.uid() and is_student()) with check(user_id=auth.uid() and is_student());
grant insert,update on public.student_profiles to authenticated;
create policy scanin_events_read on public.events for select to authenticated using(scanin_event_access(id));
create policy scanin_audience_read on public.event_audience for select to authenticated using(scanin_active() and (student_id=auth.uid() or owns_event(event_id) or is_administrator()));
create policy scanin_attendance_read on public.attendance for select to authenticated using(scanin_active() and (student_id=auth.uid() or owns_event(event_id) or is_administrator()));
create policy scanin_saved_read on public.saved_events for select to authenticated using(student_id=auth.uid() and is_student());
create policy scanin_requests_read on public.requests for select to authenticated using(scanin_active() and (requester_id=auth.uid() or is_administrator()));
create policy scanin_notices_read on public.notifications for select to authenticated using(user_id=auth.uid() and scanin_active());
create policy scanin_tokens_read on public.push_tokens for select to authenticated using(user_id=auth.uid() and scanin_active());
create policy scanin_audit_read on public.audit_log for select to authenticated using(is_administrator());
create policy scanin_settings_read on public.system_settings for select to authenticated using(scanin_active());

create or replace function public.scanin_audit(action_name text,table_name text,rid text,old_data jsonb,new_data jsonb,why text default null) returns void language sql security definer set search_path=public as $$insert into audit_log(actor_id,action,record_type,record_id,old_value,new_value,reason) values(auth.uid(),action_name,table_name,rid,old_data,new_data,why)$$;
create or replace function public.scanin_notice(uid uuid,heading text,message text,dkey text,eid uuid default null,rid uuid default null) returns void language sql security definer set search_path=public as $$insert into notifications(user_id,title,body,dedupe_key,event_id,request_id)values(uid,heading,message,dkey,eid,rid)on conflict(dedupe_key)do nothing$$;

-- Roster snapshot is frozen on first publish. Existing approved complete students only.
create or replace function public.scanin_snapshot(eid uuid) returns void language plpgsql security definer set search_path=public as $$begin
 insert into event_audience(event_id,student_id)
 select e.id,p.id from events e join profiles p on p.role='student' and p.status='approved' and not p.suspended join student_profiles s on s.user_id=p.id
 where e.id=eid and scanin_complete(p.id) and (e.audience_course is null or upper(trim(s.course))=upper(trim(e.audience_course))) and (e.audience_year is null or upper(trim(s.course_year))=upper(trim(e.audience_year))) and (e.audience_block is null or upper(trim(s.block))=upper(trim(e.audience_block))) on conflict do nothing;
 update events set roster_frozen=true where id=eid;
 end $$;
-- Backfill original non-draft events, preserving existing attendance access even if profiles are incomplete.
do $$declare e record;begin for e in select id from public.events where status<>'draft' and not roster_frozen loop perform public.scanin_snapshot(e.id);end loop;end $$;
insert into public.event_audience(event_id,student_id) select event_id,student_id from public.attendance on conflict do nothing;

create or replace function public.scanin_manage_event(eid uuid,changes jsonb,operation text default 'save',reason text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare e events;old_e jsonb;newid uuid;has_records boolean;cfg system_settings;begin
 if not can_manage_events() then raise exception 'Teacher or administrator access required';end if;
 if eid is not null then select * into e from events where id=eid for update;if not found or not (e.created_by=auth.uid() or is_administrator()) then raise exception 'Event not found';end if;old_e=to_jsonb(e);else select * into cfg from system_settings where id=1;e.late_minutes=cfg.late_minutes;e.status='draft';e.required=false;e.archived=false;e.created_by=auth.uid();e.event_code=coalesce(nullif(upper(trim(changes->>'event_code')),''),'SI-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));end if;
 if eid is null and e.event_code !~ '^SI-[A-Z0-9]{6,16}$' then raise exception 'Invalid event code format';end if;
 if eid is not null and changes?'event_code' and changes->>'event_code' is distinct from e.event_code then raise exception 'Saved event codes cannot be changed';end if;
 select exists(select 1 from attendance where event_id=eid) into has_records;
 if operation='delete' then if e.status<>'draft' or has_records then raise exception 'Only drafts without attendance can be deleted';end if;delete from events where id=eid;perform scanin_audit('delete','events',eid::text,old_e,null,reason);return eid;end if;
 if operation='archive' then if e.status='draft' or (e.end_time>now() and e.status<>'cancelled') then raise exception 'Archive completed or cancelled events only';end if;e.archived=true;
 elsif operation='cancel' then if nullif(trim(reason),'') is null then raise exception 'Cancellation reason required';end if;e.status='cancelled';e.cancel_reason=reason;
 elsif operation='close' then if e.status<>'open' then raise exception 'Only published open events can be closed';end if;e.status='closed';
 elsif operation='reopen' then if e.status<>'closed' or e.end_time<=now() then raise exception 'Only closed events before their scheduled end can reopen';end if;e.status='open';
 elsif operation in ('save','publish','admin_change') then
 if e.status='cancelled' then raise exception 'Cancelled events cannot be edited';end if;
 if operation='admin_change' and (not is_administrator() or nullif(trim(reason),'') is null) then raise exception 'Admin review and reason required';end if;
 if e.id is not null and e.end_time<=now() and operation<>'admin_change' then raise exception 'Ended event changes require admin review';end if;
 if has_records and not is_administrator() and (changes ?| array['start_time','audience_course','audience_year','audience_block','late_minutes','required']) then
 if coalesce(changes->>'start_time',e.start_time::text)::timestamptz is distinct from e.start_time or (changes ? 'audience_course' and changes->>'audience_course' is distinct from e.audience_course) or (changes ? 'audience_year' and changes->>'audience_year' is distinct from e.audience_year) or (changes ? 'audience_block' and changes->>'audience_block' is distinct from e.audience_block) or coalesce((changes->>'late_minutes')::int,e.late_minutes)<>e.late_minutes or coalesce((changes->>'required')::boolean,e.required)<>e.required then raise exception 'Audience, start time and attendance rules require admin review after attendance exists';end if;end if;
 e.title=coalesce(nullif(trim(changes->>'title'),''),e.title);e.venue=coalesce(nullif(trim(changes->>'venue'),''),e.venue);e.description=coalesce(nullif(trim(changes->>'description'),''),e.description);
 e.start_time=coalesce((changes->>'start_time')::timestamptz,e.start_time);e.end_time=coalesce((changes->>'end_time')::timestamptz,e.end_time);
 if changes?'audience_course' then e.audience_course=nullif(trim(changes->>'audience_course'),'');end if;if changes?'audience_year' then e.audience_year=nullif(trim(changes->>'audience_year'),'');end if;if changes?'audience_block' then e.audience_block=nullif(trim(changes->>'audience_block'),'');end if;
 e.required=coalesce((changes->>'required')::boolean,e.required);e.late_minutes=coalesce((changes->>'late_minutes')::integer,e.late_minutes);
 if operation='publish' then e.status='open';end if;
 if nullif(trim(e.title),'') is null or nullif(trim(e.venue),'') is null or nullif(trim(e.description),'') is null or e.start_time is null or e.end_time is null or e.end_time<=e.start_time then raise exception 'Name, venue, description and valid start/end times required';end if;
 if e.end_time<=now() and operation<>'admin_change' then raise exception 'End time must be in the future';end if;
 if e.audience_year is not null and e.audience_course is null or e.audience_block is not null and (e.audience_year is null or e.audience_course is null) then raise exception 'Select course and year before restricting block';end if;
 select * into cfg from system_settings where id=1;
 if e.audience_course is not null and not(e.audience_course=any(cfg.courses)) or e.audience_year is not null and not(e.audience_year=any(cfg.years)) or e.audience_block is not null and not(e.audience_block=any(cfg.blocks)) then raise exception 'Select official course, year and block values';end if;
 else raise exception 'Unknown event action';end if;
 if eid is null then insert into events(event_code,title,venue,description,start_time,end_time,status,created_by,required,audience_course,audience_year,audience_block,late_minutes) values(e.event_code,e.title,e.venue,e.description,e.start_time,e.end_time,e.status,auth.uid(),e.required,e.audience_course,e.audience_year,e.audience_block,e.late_minutes) returning id into newid;
 else update events set title=e.title,venue=e.venue,description=e.description,start_time=e.start_time,end_time=e.end_time,status=e.status,required=e.required,audience_course=e.audience_course,audience_year=e.audience_year,audience_block=e.audience_block,late_minutes=e.late_minutes,archived=e.archived,cancel_reason=e.cancel_reason where id=eid;newid=eid;end if;
 if e.status<>'draft' and (eid is null or not e.roster_frozen) then perform scanin_snapshot(newid);end if;
 -- A reviewed audience change refreshes only unmatched missing records; recorded attendees are preserved.
 if eid is not null and operation='admin_change' and (old_e->>'audience_course' is distinct from e.audience_course or old_e->>'audience_year' is distinct from e.audience_year or old_e->>'audience_block' is distinct from e.audience_block) then
 delete from attendance a where a.event_id=eid and a.status='absent' and a.source='system' and a.corrected_at is null and not exists(select 1 from student_profiles s where s.user_id=a.student_id and (e.audience_course is null or s.course=e.audience_course) and (e.audience_year is null or s.course_year=e.audience_year) and (e.audience_block is null or s.block=e.audience_block));
 delete from event_audience a where a.event_id=eid and not exists(select 1 from attendance r where r.event_id=eid and r.student_id=a.student_id);
 perform scanin_snapshot(eid);end if;
 if e.status='cancelled' or operation='admin_change' and e.end_time>now() then
 perform scanin_audit('reset_system_absences','attendance',newid::text,(select jsonb_agg(to_jsonb(a)) from attendance a where event_id=newid and status='absent' and source='system' and corrected_at is null),null,coalesce(reason,'Event lifecycle change'));
 delete from attendance where event_id=newid and status='absent' and source='system' and corrected_at is null;end if;
 if eid is not null and old_e is distinct from (select to_jsonb(x) from events x where id=newid) then
 perform scanin_notice(a.student_id,case when e.status='cancelled' then 'Event cancelled' else 'Event updated' end,e.title||': check the latest event details.','change:'||newid||':'||clock_timestamp()||':'||a.student_id,newid) from event_audience a where a.event_id=newid;
 end if;
 perform scanin_audit(operation,'events',newid::text,old_e,(select to_jsonb(x) from events x where id=newid),reason);return newid;end $$;

create or replace function public.scanin_record(code text,method text default 'manual',expected_event uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$declare e events;a attendance;ts timestamptz=clock_timestamp();begin
 if not is_student() then raise exception 'Only approved active students can record attendance';end if;
 if not scanin_complete(auth.uid()) then raise exception 'Complete your student details first';end if;
 select * into e from events where upper(event_code)=upper(trim(code)) for update;
 if not found then raise exception 'Invalid event code';end if;
 if expected_event is not null and expected_event<>e.id then raise exception 'This code belongs to a different event';end if;
 if not exists(select 1 from event_audience where event_id=e.id and student_id=auth.uid()) then raise exception 'You are not eligible for this event. Check its course, year and block requirements.';end if;
 select * into a from attendance where event_id=e.id and student_id=auth.uid();
 if found then return jsonb_build_object('duplicate',true,'event_id',e.id,'title',e.title,'status',a.status,'scanned_at',a.scanned_at);end if;
 if e.status<>'open' or e.archived then raise exception 'This event is not open for attendance';end if;
 if e.start_time is null or e.end_time is null then raise exception 'Event schedule is incomplete';end if;
 if ts<e.start_time then raise exception 'This event has not started yet';end if;if ts>=e.end_time then raise exception 'This event has ended';end if;
 insert into attendance(student_id,event_id,status,scanned_at,source) values(auth.uid(),e.id,case when ts<=e.start_time+make_interval(mins=>e.late_minutes) then 'present' else 'late' end,ts,case when method='qr' then 'qr' else 'manual' end) returning * into a;
 return jsonb_build_object('duplicate',false,'event_id',e.id,'title',e.title,'status',a.status,'scanned_at',a.scanned_at);
 end $$;

create or replace function public.scanin_profile_update(changes jsonb) returns void language plpgsql security definer set search_path=public as $$begin
 if not scanin_active() then raise exception 'Active account required';end if;
 if changes?'avatar_url' and changes->>'avatar_url' is not null and changes->>'avatar_url' not like '%/storage/v1/object/public/avatars/'||auth.uid()::text||'/%' then raise exception 'Upload a profile picture to your own folder';end if;
 update profiles set avatar_url=case when changes?'avatar_url' then changes->>'avatar_url' else avatar_url end,reminder_start=coalesce((changes->>'reminder_start')::boolean,reminder_start),reminder_end=coalesce((changes->>'reminder_end')::boolean,reminder_end) where id=auth.uid();end $$;
create or replace function public.scanin_account(uid uuid,new_status text,why text) returns void language plpgsql security definer set search_path=public as $$declare p profiles;begin
 if not is_administrator() or uid=auth.uid() or nullif(trim(why),'') is null then raise exception 'Admin access, a different account and a reason are required';end if;
 select * into p from profiles where id=uid for update;if not found or p.role='administrator' then raise exception 'This account cannot be managed here';end if;
 if new_status in ('approved','rejected') then if p.role<>'teacher' then raise exception 'Approval is for teacher accounts';end if;update profiles set status=new_status,status_reason=why where id=uid;
 elsif new_status in ('suspend','reactivate') then update profiles set suspended=(new_status='suspend'),status_reason=why where id=uid;
 else raise exception 'Invalid account action';end if;
 perform scanin_audit(new_status,'profiles',uid::text,to_jsonb(p),(select to_jsonb(x) from profiles x where id=uid),why);end $$;
create or replace function public.scanin_save(eid uuid,save_event boolean) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_student() or not scanin_event_access(eid) then raise exception 'Event not available';end if;
 if save_event then insert into saved_events values(eid,auth.uid()) on conflict do nothing;else delete from saved_events where event_id=eid and student_id=auth.uid();end if;end $$;
create or replace function public.scanin_mark_read(nid uuid default null) returns void language plpgsql security definer set search_path=public as $$begin if not scanin_active() then raise exception 'Active account required';end if;update notifications set read_at=now() where user_id=auth.uid() and (nid is null or id=nid);end $$;
create or replace function public.scanin_push_token(value text) returns void language plpgsql security definer set search_path=public as $$begin if not scanin_active() or value not like 'ExponentPushToken[%]' and value not like 'ExpoPushToken[%]' then raise exception 'Valid device token and active session required';end if;insert into push_tokens(user_id,token)values(auth.uid(),value)on conflict(token)do update set user_id=auth.uid(),updated_at=now();end $$;

create or replace function public.scanin_request(kind_name text,eid uuid,sid uuid,proposed jsonb,why text,file_path text default null) returns uuid language plpgsql security definer set search_path=public as $$declare rid uuid;pr profiles;begin
 if not scanin_active() or nullif(trim(why),'') is null then raise exception 'Active account and explanation required';end if;
 select * into pr from profiles where id=auth.uid();
 if kind_name='profile' then if pr.role<>'student' or sid is distinct from auth.uid() then raise exception 'Profile requests are for your own student details';end if;
 elsif kind_name='attendance' then if not scanin_event_access(eid) or not exists(select 1 from event_audience where event_id=eid and student_id=sid) or pr.role='student' and sid is distinct from auth.uid() then raise exception 'Student is not assigned to this event';end if;
 elsif kind_name='event' then if proposed='{}'::jsonb then raise exception 'Propose the event changes from the event editor';end if;if not owns_event(eid) then raise exception 'Only the organizer may request event changes';end if;
 else raise exception 'Unknown request type';end if;
 if file_path is not null and file_path not like auth.uid()::text||'/%' then raise exception 'Invalid attachment';end if;
 if exists(select 1 from requests where requester_id=auth.uid() and kind=kind_name and event_id is not distinct from eid and student_id is not distinct from sid and status='pending') then raise exception 'A matching request is already pending';end if;
 insert into requests(requester_id,kind,event_id,student_id,payload,reason,attachment)values(auth.uid(),kind_name,eid,sid,proposed,trim(why),file_path)returning id into rid;
 perform scanin_notice(id,'New request',pr.full_name||' submitted a '||kind_name||' request.','request:'||rid||':'||id,eid,rid) from profiles where role='administrator' and status='approved' and not suspended;return rid;end $$;

create or replace function public.scanin_correct(eid uuid,sid uuid,new_status text,why text) returns void language plpgsql security definer set search_path=public as $$declare old_a jsonb;begin
 if not is_administrator() or new_status not in ('present','late','absent','void') or nullif(trim(why),'') is null then raise exception 'Admin, valid correction and reason required';end if;
 perform 1 from events where id=eid for update;
 if not exists(select 1 from event_audience where event_id=eid and student_id=sid) then raise exception 'Student is outside this event audience';end if;
 if exists(select 1 from events where id=eid and (status='cancelled' or not required) and new_status='absent') then raise exception 'Absent is only valid for required non-cancelled events';end if;
 select to_jsonb(a) into old_a from attendance a where event_id=eid and student_id=sid;
 if new_status='void' then delete from attendance where event_id=eid and student_id=sid;else
 insert into attendance(event_id,student_id,status,scanned_at,source,corrected_at,correction_reason)values(eid,sid,new_status,null,'admin',now(),why)
 on conflict(student_id,event_id)do update set status=excluded.status,corrected_at=now(),correction_reason=why;
 end if;
 perform scanin_audit('correct','attendance',eid||':'||sid,old_a,(select to_jsonb(a) from attendance a where event_id=eid and student_id=sid),why);
 perform scanin_notice(sid,'Attendance reviewed','Your attendance record was reviewed by an administrator.','correction:'||eid||':'||sid||':'||clock_timestamp(),eid);end $$;

create or replace function public.scanin_resolve(rid uuid,approve boolean,note text) returns void language plpgsql security definer set search_path=public as $$declare r requests;begin
 if not is_administrator() or nullif(trim(note),'') is null then raise exception 'Admin access and response note required';end if;
 select * into r from requests where id=rid for update;if not found or r.status<>'pending' then raise exception 'Request is no longer pending';end if;
 if approve then
 if r.kind='attendance' then perform scanin_correct(r.event_id,r.student_id,r.payload->>'status',note);
 elsif r.kind='event' then perform scanin_manage_event(r.event_id,r.payload,'admin_change',note);
 elsif r.kind='profile' then perform scanin_admin_details(r.student_id,r.payload,note);
 end if;end if;
 update requests set status=case when approve then 'resolved' else 'declined' end,response=note,reviewed_by=auth.uid(),reviewed_at=now() where id=rid;
 perform scanin_audit(case when approve then 'approve_request' else 'decline_request' end,'requests',rid::text,to_jsonb(r),(select to_jsonb(x) from requests x where id=rid),note);
 perform scanin_notice(r.requester_id,'Request reviewed',note,'resolved:'||rid,r.event_id,rid);end $$;
create or replace function public.scanin_settings(changes jsonb,why text) returns void language plpgsql security definer set search_path=public as $$declare old_s jsonb;begin
 if not is_administrator() or nullif(trim(why),'') is null then raise exception 'Admin access and reason required';end if;
 select to_jsonb(s) into old_s from system_settings s where id=1;
 update system_settings set late_minutes=coalesce((changes->>'late_minutes')::int,late_minutes),reminder_start_minutes=coalesce((changes->>'reminder_start_minutes')::int,reminder_start_minutes),reminder_end_minutes=coalesce((changes->>'reminder_end_minutes')::int,reminder_end_minutes),courses=case when changes?'courses' then array(select jsonb_array_elements_text(changes->'courses')) else courses end,years=case when changes?'years' then array(select jsonb_array_elements_text(changes->'years')) else years end,blocks=case when changes?'blocks' then array(select jsonb_array_elements_text(changes->'blocks')) else blocks end where id=1;
 perform scanin_audit('settings','system_settings','1',old_s,(select to_jsonb(s) from system_settings s where id=1),why);end $$;
-- Minute worker. Ended is a derived status; server validation rejects scans at the exact end time.
create or replace function public.scanin_tick() returns void language plpgsql security definer set search_path=public as $$declare e events;cfg system_settings;begin
 select * into cfg from system_settings where id=1;
 for e in select * from events where status not in ('draft','cancelled') order by id for update loop
 if e.required and e.end_time<=now() then insert into attendance(student_id,event_id,status,scanned_at,source)select a.student_id,e.id,'absent',null,'system' from event_audience a where a.event_id=e.id on conflict(student_id,event_id)do nothing;end if;
 if e.status='open' and not e.archived and e.start_time>now() and e.start_time<=now()+make_interval(mins=>cfg.reminder_start_minutes) then
 perform scanin_notice(a.student_id,'Event starts soon',e.title||' starts soon. View its schedule in ScanIn.','start:'||e.id||':'||e.start_time||':'||a.student_id,e.id)from event_audience a join profiles p on p.id=a.student_id where a.event_id=e.id and p.reminder_start and not p.suspended and (e.required or exists(select 1 from saved_events s where s.event_id=e.id and s.student_id=a.student_id));
 if exists(select 1 from profiles where id=e.created_by and reminder_start and not suspended) then perform scanin_notice(e.created_by,'Your event starts soon',e.title,'teacher-start:'||e.id||':'||e.start_time,e.id);end if;
 end if;
 if e.status='open' and not e.archived and e.start_time<=now() and e.end_time>now() and e.end_time<=now()+make_interval(mins=>cfg.reminder_end_minutes) then
 perform scanin_notice(a.student_id,'Event ends soon',e.title||' is ending soon. Record your attendance before it ends.','end:'||e.id||':'||e.end_time||':'||a.student_id,e.id)from event_audience a join profiles p on p.id=a.student_id where a.event_id=e.id and p.reminder_end and not p.suspended and not exists(select 1 from attendance r where r.event_id=e.id and r.student_id=a.student_id);
 if exists(select 1 from profiles where id=e.created_by and reminder_end and not suspended) then perform scanin_notice(e.created_by,'Your event ends soon',e.title,'teacher-end:'||e.id||':'||e.end_time,e.id);end if;
 end if;
 if e.created_by is not null and e.end_time<=now() then perform scanin_notice(e.created_by,'Event summary ready',e.title||' has ended. View its attendance report.','summary:'||e.id||':'||e.end_time,e.id);end if;
 end loop;end $$;

-- Authenticated maintenance is restricted to events visible to the caller; safe to call on refresh.
create or replace function public.scanin_sync() returns timestamptz language plpgsql security definer set search_path=public as $$declare e events;begin
 if not scanin_active() then raise exception 'Active account required';end if;
 for e in select * from events where required and status not in ('draft','cancelled') and end_time<=now() and scanin_event_access(id) for update loop
 insert into attendance(student_id,event_id,status,scanned_at,source)select student_id,e.id,'absent',null,'system' from event_audience where event_id=e.id on conflict(student_id,event_id)do nothing;end loop;return clock_timestamp();end $$;

-- Storage: public avatars are non-sensitive; request screenshots use private signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),('request-files','request-files',false,5242880,array['image/jpeg','image/png','image/webp'])on conflict(id)do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists scanin_storage_insert on storage.objects;
create policy scanin_storage_insert on storage.objects for insert to authenticated with check(bucket_id in ('avatars','request-files') and (storage.foldername(name))[1]=auth.uid()::text and scanin_active());
drop policy if exists scanin_storage_read on storage.objects;
create policy scanin_storage_read on storage.objects for select to authenticated using(bucket_id='avatars' or bucket_id='request-files' and ((storage.foldername(name))[1]=auth.uid()::text or is_administrator()));

-- All SECURITY DEFINER helpers start private. Explicitly expose only scoped public entrypoints.
do $$declare f record;begin for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'scanin_%' loop execute format('revoke all on function %s from public,anon,authenticated',f.sig);end loop;end $$;
grant execute on function public.scanin_active(),public.scanin_event_access(uuid),public.scanin_person_access(uuid),public.scanin_complete(uuid) to authenticated;
grant execute on function public.scanin_manage_event(uuid,jsonb,text,text),public.scanin_record(text,text,uuid),public.scanin_profile_update(jsonb),public.scanin_account(uuid,text,text),public.scanin_save(uuid,boolean),public.scanin_mark_read(uuid),public.scanin_push_token(text),public.scanin_request(text,uuid,uuid,jsonb,text,text),public.scanin_correct(uuid,uuid,text,text),public.scanin_resolve(uuid,boolean,text),public.scanin_settings(jsonb,text),public.scanin_sync() to authenticated;
grant execute on function public.scanin_tick() to service_role;
-- Publication entries for refresh hooks.
do $$declare t text;begin foreach t in array array['profiles','student_profiles','event_audience','saved_events','requests','notifications','system_settings'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;end loop;end $$;

-- Device token cleanup prevents notifications to a signed-out account.
create or replace function public.scanin_remove_push_token(value text) returns void language plpgsql security definer set search_path=public as $$begin delete from push_tokens where token=value and user_id=auth.uid();end $$;
revoke all on function public.scanin_remove_push_token(text) from public,anon;
grant execute on function public.scanin_remove_push_token(text) to authenticated;
create or replace function public.scanin_validate_details() returns trigger language plpgsql security definer set search_path=public as $$declare cfg system_settings;begin
 select * into cfg from system_settings where id=1;
 if nullif(trim(new.student_id_no),'') is null then raise exception 'Student ID is required';end if;
 if new.course is not null and not(new.course=any(cfg.courses)) then raise exception 'Select an official course';end if;
 if new.course_year is not null and not(new.course_year=any(cfg.years)) then raise exception 'Select an official year level';end if;
 if new.block is not null and not(new.block=any(cfg.blocks)) then raise exception 'Select an official block';end if;
 if new.age is not null and (new.age<0 or new.age>120) then raise exception 'Invalid age';end if;
 if new.email is not null and new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid contact email';end if;
 if new.phone is not null and new.phone !~ '^[+0-9 ()-]{7,20}$' then raise exception 'Invalid phone number';end if;
 perform pg_advisory_xact_lock(hashtext(new.student_id_no));
 if exists(select 1 from student_profiles where student_id_no=new.student_id_no and user_id<>new.user_id) then raise exception 'Student ID is already registered';end if;
 return new;end $$;
revoke all on function public.scanin_validate_details() from public,anon,authenticated;
drop trigger if exists scanin_validate_details on public.student_profiles;
create trigger scanin_validate_details before insert or update on public.student_profiles for each row execute function public.scanin_validate_details();
create or replace function public.scanin_teacher_notice() returns trigger language plpgsql security definer set search_path=public as $$begin
 if new.role='teacher' and new.status='pending' then perform scanin_notice(id,'Teacher approval required',coalesce(new.full_name,new.email)||' requested a teacher account.','teacher:'||new.id||':'||id) from profiles where role='administrator' and status='approved' and not suspended;end if;return new;end $$;
revoke all on function public.scanin_teacher_notice() from public,anon,authenticated;
drop trigger if exists scanin_teacher_notice on public.profiles;
create trigger scanin_teacher_notice after insert on public.profiles for each row execute function public.scanin_teacher_notice();

alter table public.notifications add column if not exists push_attempts integer not null default 0;
alter table public.notifications add column if not exists push_claimed_at timestamptz;
create or replace function public.scanin_claim_push() returns setof public.notifications language sql security definer set search_path=public as $$
 update notifications set push_attempts=push_attempts+1,push_claimed_at=now() where id in (select id from notifications where not push_sent and push_attempts<5 and (push_claimed_at is null or push_claimed_at<now()-interval '5 minutes') order by created_at for update skip locked limit 50) returning *;
$$;
revoke all on function public.scanin_claim_push() from public,anon,authenticated;
grant execute on function public.scanin_claim_push() to service_role;
-- Opening/refreshing the app can safely run time-based housekeeping too; no user-supplied timestamps.
create or replace function public.scanin_sync() returns timestamptz language plpgsql security definer set search_path=public as $$begin
 if not scanin_active() then raise exception 'Active account required';end if;perform scanin_tick();return clock_timestamp();end $$;
revoke all on function public.scanin_sync() from public,anon;
grant execute on function public.scanin_sync() to authenticated;
create or replace function public.scanin_admin_details(uid uuid,changes jsonb,why text) returns void language plpgsql security definer set search_path=public as $$declare k text;v text;old_s jsonb;old_p jsonb;begin
 if not is_administrator() or nullif(trim(why),'') is null then raise exception 'Admin access and reason required';end if;
 if not exists(select 1 from profiles where id=uid and role='student') then raise exception 'Student account required';end if;
 select to_jsonb(s) into old_s from student_profiles s where user_id=uid;select to_jsonb(p) into old_p from profiles p where id=uid;
 for k,v in select * from jsonb_each_text(changes) loop
 if nullif(trim(v),'') is null then raise exception 'Correction values cannot be blank';end if;
 if k='full_name' then update profiles set full_name=trim(v) where id=uid;
 elsif k in ('student_id_no','course','course_year','block','gender','phone','email') then execute format('update public.student_profiles set %I=$1 where user_id=$2',k) using trim(v),uid;
 else raise exception 'Unsupported profile field';end if;end loop;
 perform scanin_audit('correct_details','student_profiles',uid::text,jsonb_build_object('profile',old_p,'details',old_s),jsonb_build_object('profile',(select to_jsonb(p) from profiles p where id=uid),'details',(select to_jsonb(s) from student_profiles s where user_id=uid)),why);end $$;
revoke all on function public.scanin_admin_details(uuid,jsonb,text) from public,anon;
grant execute on function public.scanin_admin_details(uuid,jsonb,text) to authenticated;
-- Invalidate queued reminders after event changes or a student records attendance.
create or replace function public.scanin_invalidate_reminders() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='events' then update notifications set push_sent=true,read_at=coalesce(read_at,now()) where event_id=new.id and not push_sent and (dedupe_key like 'start:%' or dedupe_key like 'end:%');
 else update notifications set push_sent=true,read_at=coalesce(read_at,now()) where event_id=new.event_id and user_id=new.student_id and not push_sent and dedupe_key like 'end:%';end if;return new;end $$;
revoke all on function public.scanin_invalidate_reminders() from public,anon,authenticated;
drop trigger if exists scanin_invalidate_reminders_event on public.events;
create trigger scanin_invalidate_reminders_event after update on public.events for each row execute function public.scanin_invalidate_reminders();
drop trigger if exists scanin_invalidate_reminders_attendance on public.attendance;
create trigger scanin_invalidate_reminders_attendance after insert or update on public.attendance for each row execute function public.scanin_invalidate_reminders();

-- Reconcile new completed profiles and approved corrections for unfinished events only.
-- Completed-event rosters remain stable; previously recorded attendees remain in their original roster.
create or replace function public.scanin_reconcile_student() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not exists(select 1 from profiles where id=new.user_id and role='student' and status='approved' and not suspended) then return new;end if;
 delete from event_audience a using events e where a.event_id=e.id and a.student_id=new.user_id and e.end_time>now() and e.status in ('open','closed') and not exists(select 1 from attendance r where r.event_id=e.id and r.student_id=new.user_id) and not (
 scanin_complete(new.user_id) and (e.audience_course is null or e.audience_course=new.course) and (e.audience_year is null or e.audience_year=new.course_year) and (e.audience_block is null or e.audience_block=new.block));
 insert into event_audience(event_id,student_id) select e.id,new.user_id from events e where e.status in ('open','closed') and e.end_time>now() and not e.archived and scanin_complete(new.user_id) and (e.audience_course is null or e.audience_course=new.course) and (e.audience_year is null or e.audience_year=new.course_year) and (e.audience_block is null or e.audience_block=new.block) on conflict do nothing;
 return new;end $$;
revoke all on function public.scanin_reconcile_student() from public,anon,authenticated;
drop trigger if exists scanin_reconcile_student on public.student_profiles;
create trigger scanin_reconcile_student after insert or update on public.student_profiles for each row execute function public.scanin_reconcile_student();

-- Lock only truly complete details, not rows containing blank required strings.
create or replace function public.prevent_student_profile_edit_when_complete() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null or is_administrator() then return new;end if;
 if scanin_complete(old.user_id) then raise exception 'Student details are locked once complete. Request an administrator correction.';end if;return new;end $$;
-- Explicit service grants for the server worker; authenticated clients still have read-only table grants.
grant all on public.profiles,public.student_profiles,public.events,public.attendance,public.event_audience,public.saved_events,public.requests,public.notifications,public.push_tokens,public.audit_log,public.system_settings to service_role;
grant usage,select on sequence public.audit_log_id_seq to service_role;
commit;
