alter table events add column time_limit_minutes int, add column points_per_checkpoint int not null default 100, add column wrong_penalty int not null default 0,
 add column hint_penalty int not null default 0, add column finish_bonus int not null default 0;
create table hint_uses(team_id uuid references teams on delete cascade,checkpoint_order int,created_at timestamptz default now(),primary key(team_id,checkpoint_order));
alter table hint_uses enable row level security;
create policy hints_admin on hint_uses for select using(is_admin());
alter table activity_log drop constraint activity_log_kind_check;
alter table activity_log add constraint activity_log_kind_check check(kind in('scan','correct','incorrect','completed','finished','invalid_scan','hint'));

-- join/scan now RETURN errors (a raised exception would roll back the failure log).
create or replace function join_team(p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid:=auth.uid(); t teams; bad int;
begin
 if uid is null then return jsonb_build_object('error','not_signed_in'); end if;
 select count(*) into bad from audit_logs where actor=uid and action='join_failed' and created_at>now()-interval '5 minutes';
 if bad>=10 then return jsonb_build_object('error','rate_limited'); end if;
 select * into t from teams where join_code_hash=encode(digest(upper(btrim(p_code)),'sha256'),'hex');
 if not found then insert into audit_logs(actor,action) values(uid,'join_failed'); return jsonb_build_object('error','invalid_code'); end if;
 insert into team_members(user_id,team_id) values(uid,t.id) on conflict(user_id) do update set team_id=excluded.team_id;
 return jsonb_build_object('team',t.name);
end$$;

create or replace function scan_checkpoint(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); r team_routes; p team_progress; ev events;
begin
 if tid is null then return jsonb_build_object('error','not_a_team_member'); end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then return jsonb_build_object('error','game_not_live'); end if;
 select * into p from team_progress where team_id=tid;
 if p.started_at is not null and p.finished_at is null and ev.time_limit_minutes is not null and now()>p.started_at+make_interval(mins=>ev.time_limit_minutes) then return jsonb_build_object('error','time_up'); end if;
 select * into r from team_routes where team_id=tid and qr_token_hash=encode(digest(p_token,'sha256'),'hex') and not revoked;
 if not found then insert into activity_log(team_id,kind) values(tid,'invalid_scan'); return jsonb_build_object('error','invalid_qr'); end if;
 insert into team_progress(team_id) values(tid) on conflict do nothing;
 select * into p from team_progress where team_id=tid for update;
 if r.checkpoint_order<>p.completed_order+1 then insert into activity_log(team_id,kind,checkpoint_order) values(tid,'invalid_scan',r.checkpoint_order); return jsonb_build_object('error','out_of_sequence'); end if;
 update team_progress set scanned_order=r.checkpoint_order,started_at=coalesce(started_at,now()),last_activity=now() where team_id=tid;
 return jsonb_build_object('checkpoint',r.checkpoint_order);
end$$;

create or replace function submit_answer(p_answer text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); p team_progress; ev events; r team_routes; s stations; acc text[]; total int; ok bool; fails int;
begin
 if tid is null then raise exception 'not_a_team_member'; end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then raise exception 'game_not_live'; end if;
 select * into p from team_progress where team_id=tid for update;
 if not found or p.scanned_order<>p.completed_order+1 then raise exception 'scan_first'; end if;
 if p.started_at is not null and ev.time_limit_minutes is not null and now()>p.started_at+make_interval(mins=>ev.time_limit_minutes) then raise exception 'time_up'; end if;
 select count(*) into fails from answer_attempts where team_id=tid and checkpoint_order=p.scanned_order and not correct and created_at>now()-interval '1 minute';
 if fails>=ev.max_attempts then raise exception 'rate_limited'; end if;
 select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order;
 select * into s from stations where id=r.station_id;
 select accepted into acc from station_answers where station_id=r.station_id;
 select count(*) into total from team_routes where team_id=tid;
 ok:=exists(select 1 from unnest(acc) a where lower(btrim(a))=lower(btrim(p_answer)));
 insert into answer_attempts(team_id,checkpoint_order,correct) values(tid,p.scanned_order,ok);
 if not ok then return jsonb_build_object('correct',false); end if;
 update team_progress set completed_order=scanned_order,last_activity=now(),finished_at=case when scanned_order=total then now() else finished_at end where team_id=tid;
 return jsonb_build_object('correct',true,'finished',p.scanned_order=total,'message',s.success_message,'quote',s.quote);
end$$;

create function request_hint() returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); p team_progress; ev events; r team_routes; s stations;
begin
 if tid is null then raise exception 'not_a_team_member'; end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then raise exception 'game_not_live'; end if;
 if not ev.hints_enabled then raise exception 'hints_off'; end if;
 select * into p from team_progress where team_id=tid;
 if not found or p.scanned_order<>p.completed_order+1 then raise exception 'scan_first'; end if;
 select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
 if s.hint is null then return jsonb_build_object('hint',null); end if;
 insert into hint_uses(team_id,checkpoint_order) values(tid,p.scanned_order) on conflict do nothing;
 if found then insert into activity_log(team_id,kind,checkpoint_order) values(tid,'hint',p.scanned_order); end if;
 return jsonb_build_object('hint',s.hint);
end$$;

create or replace function get_my_state() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); t teams; ev events; p team_progress; total int; r team_routes; s stations; clue jsonb;
begin
 if tid is null then return null; end if;
 select * into t from teams where id=tid; select * into ev from events where id=t.event_id;
 select * into p from team_progress where team_id=tid; select count(*) into total from team_routes where team_id=tid;
 if p.team_id is not null and p.scanned_order>p.completed_order and p.finished_at is null then
  select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
  clue:=jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,
   'hint',case when ev.hints_enabled and exists(select 1 from hint_uses h where h.team_id=tid and h.checkpoint_order=p.scanned_order) then s.hint end,
   'hint_available',ev.hints_enabled and s.hint is not null,'hint_penalty',ev.hint_penalty);
 end if;
 return jsonb_build_object('team',t.name,'color',t.color,'event',ev.name,'status',ev.status,'completed',coalesce(p.completed_order,0),'total',total,
  'started_at',p.started_at,'finished_at',p.finished_at,'clue',clue,'victory',ev.victory_message,'instructions',ev.instructions,
  'deadline',case when ev.time_limit_minutes is not null and p.started_at is not null and p.finished_at is null then p.started_at+make_interval(mins=>ev.time_limit_minutes) end);
end$$;

-- Publishing a route resets that team's progress so progress never points at a different route.
create or replace function publish_route(p_team uuid,p_stations uuid[]) returns int language plpgsql security definer set search_path=public,extensions as $$
declare i int; tok text;
begin perform require_admin();
 if (select count(distinct s) from unnest(p_stations) s)<>cardinality(p_stations) then raise exception 'duplicate_station'; end if;
 delete from team_routes where team_id=p_team;
 for i in 1..cardinality(p_stations) loop
  tok:=encode(gen_random_bytes(24),'hex');
  insert into team_routes(team_id,checkpoint_order,station_id,qr_token_hash,qr_token_plain) values(p_team,i,p_stations[i],encode(digest(tok,'sha256'),'hex'),tok);
 end loop;
 insert into team_progress(team_id) values(p_team) on conflict do nothing;
 update team_progress set scanned_order=0,completed_order=0,started_at=null,finished_at=null,last_activity=null where team_id=p_team;
 delete from hint_uses where team_id=p_team;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'publish_route',jsonb_build_object('team',p_team,'n',cardinality(p_stations)));
 return cardinality(p_stations); end$$;

create or replace function reset_team(p_team uuid) returns void language plpgsql security definer set search_path=public,extensions as $$
begin perform require_admin();
 delete from answer_attempts where team_id=p_team; delete from hint_uses where team_id=p_team;
 update team_progress set scanned_order=0,completed_order=0,started_at=null,finished_at=null,last_activity=null where team_id=p_team;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'reset_team',jsonb_build_object('team',p_team)); end$$;
revoke all on function request_hint() from public; grant execute on function request_hint() to authenticated;
