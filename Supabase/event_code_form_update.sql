-- Existing ScanIn databases: run this focused update to save the visible pre-generated code.
-- No tables or environment values are changed.
begin;
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

commit;
