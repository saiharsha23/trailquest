-- TrailQuest core schema. Answers and token hashes live in tables with NO team policies.
create extension if not exists pgcrypto;
create table events(id uuid primary key default gen_random_uuid(),name text not null,status text not null default 'draft' check(status in('draft','live','paused','ended')),
 max_attempts int not null default 5,created_at timestamptz default now());
create table admins(user_id uuid primary key references auth.users on delete cascade);
create table teams(id uuid primary key default gen_random_uuid(),event_id uuid not null references events on delete cascade,name text not null,color text not null,player_count int not null default 0,
 join_code_hash text,created_at timestamptz default now());
create table team_members(user_id uuid primary key references auth.users on delete cascade,team_id uuid not null references teams on delete cascade);
create table stations(id uuid primary key default gen_random_uuid(),event_id uuid not null references events on delete cascade,name text not null,location_desc text,
 clue_title text not null,clue_text text not null,hint text,success_message text,quote text,active bool not null default true,sort int default 0);
create table station_answers(station_id uuid primary key references stations on delete cascade,accepted text[] not null);
create table team_routes(team_id uuid references teams on delete cascade,checkpoint_order int not null,station_id uuid not null references stations,
 qr_token_hash text not null unique,revoked bool not null default false,primary key(team_id,checkpoint_order),unique(team_id,station_id));
create table team_progress(team_id uuid primary key references teams on delete cascade,scanned_order int not null default 0,completed_order int not null default 0,
 started_at timestamptz,finished_at timestamptz,last_activity timestamptz);
create table answer_attempts(id bigserial primary key,team_id uuid references teams,checkpoint_order int,correct bool,created_at timestamptz default now());
create table audit_logs(id bigserial primary key,actor uuid,action text,detail jsonb,created_at timestamptz default now());

create function is_admin() returns bool language sql stable security definer set search_path=public,extensions as $$select exists(select 1 from admins where user_id=auth.uid())$$;
create function my_team() returns uuid language sql stable security definer set search_path=public,extensions as $$select team_id from team_members where user_id=auth.uid()$$;

alter table events enable row level security;alter table admins enable row level security;alter table teams enable row level security;alter table team_members enable row level security;
alter table stations enable row level security;alter table station_answers enable row level security;alter table team_routes enable row level security;
alter table team_progress enable row level security;alter table answer_attempts enable row level security;alter table audit_logs enable row level security;
create policy events_read on events for select using(is_admin() or exists(select 1 from teams t where t.event_id=events.id and t.id=my_team()));
create policy events_admin on events for all using(is_admin()) with check(is_admin());
create policy teams_read on teams for select using(is_admin() or id=my_team());
create policy teams_admin on teams for all using(is_admin()) with check(is_admin());
create policy progress_read on team_progress for select using(is_admin() or team_id=my_team());
create policy stations_admin on stations for all using(is_admin()) with check(is_admin());
create policy answers_admin on station_answers for all using(is_admin()) with check(is_admin());
create policy routes_admin on team_routes for all using(is_admin()) with check(is_admin());
create policy attempts_admin on answer_attempts for select using(is_admin());
create policy audit_admin on audit_logs for select using(is_admin());
-- Teams read clues only through scan_checkpoint(); stations has no team policy.

create function scan_checkpoint(p_token text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); r team_routes; p team_progress; ev events; s stations;
begin
 if tid is null then raise exception 'not_a_team_member'; end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then raise exception 'game_not_live'; end if;
 select * into r from team_routes where team_id=tid and qr_token_hash=encode(digest(p_token,'sha256'),'hex') and not revoked;
 if not found then raise exception 'invalid_qr'; end if;
 insert into team_progress(team_id) values(tid) on conflict do nothing;
 select * into p from team_progress where team_id=tid for update;
 if r.checkpoint_order<>p.completed_order+1 then raise exception 'out_of_sequence'; end if;
 update team_progress set scanned_order=r.checkpoint_order,started_at=coalesce(started_at,now()),last_activity=now() where team_id=tid;
 select * into s from stations where id=r.station_id;
 return jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,'hint',s.hint);
end$$;

create function submit_answer(p_answer text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); p team_progress; ev events; r team_routes; s stations; acc text[]; total int; ok bool; fails int;
begin
 if tid is null then raise exception 'not_a_team_member'; end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then raise exception 'game_not_live'; end if;
 select * into p from team_progress where team_id=tid for update;
 if not found or p.scanned_order<>p.completed_order+1 then raise exception 'scan_first'; end if;
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
revoke all on function scan_checkpoint(text),submit_answer(text) from public;
grant execute on function scan_checkpoint(text),submit_answer(text) to authenticated;
-- First admin: after creating the user in Supabase Auth, run in the SQL editor:
--   insert into admins(user_id) select id from auth.users where email='you@example.com';
create policy admins_self on admins for select using(user_id=auth.uid());
alter table team_routes add column qr_token_plain text; -- admin-only (no team policy); needed to print QR cards
create function require_admin() returns void language plpgsql stable as $$begin if not is_admin() then raise exception 'forbidden'; end if; end$$;

create function seed_event(p_name text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare eid uuid; n text; i int:=0; c text[]:=array['#B85C46','#6F8FAF','#7D9A7A','#B97719']; cn text[]:=array['Red','Blue','Green','Yellow']; pc int[]:=array[9,9,10,10];
begin perform require_admin();
 insert into events(name) values(p_name) returning id into eid;
 for i in 1..4 loop insert into teams(event_id,name,color,player_count) values(eid,'Team '||cn[i],c[i],pc[i]); end loop;
 foreach n in array array['Library','Sports Room','Kitchen','Garden','Dining Hall','Electrician Room','Guest Room','Yard'] loop
  insert into stations(event_id,name,clue_title,clue_text,sort) values(eid,n,'Untitled clue','Write your riddle here.',i); i:=i+1; end loop;
 return eid; end$$;

create function rotate_join_code(p_team uuid) returns text language plpgsql security definer set search_path=public,extensions as $$
declare code text:=upper(encode(gen_random_bytes(4),'hex'));
begin perform require_admin();
 update teams set join_code_hash=encode(digest(code,'sha256'),'hex') where id=p_team;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'rotate_join_code',jsonb_build_object('team',p_team));
 return code; end$$;  -- plaintext returned once; only the hash is stored

create function publish_route(p_team uuid,p_stations uuid[]) returns int language plpgsql security definer set search_path=public,extensions as $$
declare i int; tok text;
begin perform require_admin();
 if (select count(distinct s) from unnest(p_stations) s)<>cardinality(p_stations) then raise exception 'duplicate_station'; end if;
 delete from team_routes where team_id=p_team;
 for i in 1..cardinality(p_stations) loop
  tok:=encode(gen_random_bytes(24),'hex');
  insert into team_routes(team_id,checkpoint_order,station_id,qr_token_hash,qr_token_plain) values(p_team,i,p_stations[i],encode(digest(tok,'sha256'),'hex'),tok);
 end loop;
 insert into team_progress(team_id) values(p_team) on conflict do nothing;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'publish_route',jsonb_build_object('team',p_team,'n',cardinality(p_stations)));
 return cardinality(p_stations); end$$;
revoke all on function seed_event(text),rotate_join_code(uuid),publish_route(uuid,uuid[]) from public;
grant execute on function seed_event(text),rotate_join_code(uuid),publish_route(uuid,uuid[]) to authenticated;
-- Team players sign in anonymously (enable "Anonymous sign-ins" in Supabase Auth), then join with a team code.
create function join_team(p_code text) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid:=auth.uid(); t teams; bad int;
begin
 if uid is null then raise exception 'not_signed_in'; end if;
 select count(*) into bad from audit_logs where actor=uid and action='join_failed' and created_at>now()-interval '5 minutes';
 if bad>=10 then raise exception 'rate_limited'; end if;
 select * into t from teams where join_code_hash=encode(digest(upper(btrim(p_code)),'sha256'),'hex');
 if not found then insert into audit_logs(actor,action) values(uid,'join_failed'); raise exception 'invalid_code'; end if;
 insert into team_members(user_id,team_id) values(uid,t.id) on conflict(user_id) do update set team_id=excluded.team_id;
 return jsonb_build_object('team',t.name);
end$$;

create function get_my_state() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); t teams; ev events; p team_progress; total int; r team_routes; s stations; clue jsonb;
begin
 if tid is null then return null; end if;
 select * into t from teams where id=tid; select * into ev from events where id=t.event_id;
 select * into p from team_progress where team_id=tid; select count(*) into total from team_routes where team_id=tid;
 if p.team_id is not null and p.scanned_order>p.completed_order and p.finished_at is null then
  select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
  clue:=jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,'hint',s.hint);
 end if;
 return jsonb_build_object('team',t.name,'color',t.color,'event',ev.name,'status',ev.status,'completed',coalesce(p.completed_order,0),'total',total,
  'started_at',p.started_at,'finished_at',p.finished_at,'clue',clue);
end$$;
revoke all on function join_team(text),get_my_state() from public;
grant execute on function join_team(text),get_my_state() to authenticated;
create table activity_log(id bigserial primary key,team_id uuid not null references teams on delete cascade,kind text not null check(kind in('scan','correct','incorrect','completed','finished')),
 checkpoint_order int,created_at timestamptz not null default now());
create index on activity_log(created_at desc);
alter table activity_log enable row level security;
create policy activity_admin on activity_log for select using(is_admin());

-- Events are written by triggers so scan_checkpoint/submit_answer stay unchanged.
create function log_progress() returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin
 if new.scanned_order is distinct from old.scanned_order and new.scanned_order>0 then insert into activity_log(team_id,kind,checkpoint_order) values(new.team_id,'scan',new.scanned_order); end if;
 if new.completed_order is distinct from old.completed_order and new.completed_order>0 then insert into activity_log(team_id,kind,checkpoint_order) values(new.team_id,'completed',new.completed_order); end if;
 if new.finished_at is not null and old.finished_at is null then insert into activity_log(team_id,kind,checkpoint_order) values(new.team_id,'finished',new.completed_order); end if;
 return new; end$$;
create trigger trg_progress after update on team_progress for each row execute function log_progress();
create function log_attempt() returns trigger language plpgsql security definer set search_path=public,extensions as $$
begin insert into activity_log(team_id,kind,checkpoint_order) values(new.team_id,case when new.correct then 'correct' else 'incorrect' end,new.checkpoint_order); return new; end$$;
create trigger trg_attempt after insert on answer_attempts for each row execute function log_attempt();

create function set_game_status(p_event uuid,p_status text) returns void language plpgsql security definer set search_path=public,extensions as $$
declare cur text;
begin perform require_admin(); select status into cur from events where id=p_event;
 if not ((cur in('draft') and p_status='live') or (cur='live' and p_status in('paused','ended')) or (cur='paused' and p_status in('live','ended'))) then raise exception 'bad_transition'; end if;
 update events set status=p_status where id=p_event;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'game_'||p_status,jsonb_build_object('event',p_event)); end$$;

create function reset_team(p_team uuid) returns void language plpgsql security definer set search_path=public,extensions as $$
begin perform require_admin();
 delete from answer_attempts where team_id=p_team;
 update team_progress set scanned_order=0,completed_order=0,started_at=null,finished_at=null,last_activity=null where team_id=p_team;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'reset_team',jsonb_build_object('team',p_team)); end$$;

create function regenerate_token(p_team uuid,p_order int) returns void language plpgsql security definer set search_path=public,extensions as $$
declare tok text:=encode(gen_random_bytes(24),'hex');
begin perform require_admin();
 update team_routes set qr_token_hash=encode(digest(tok,'sha256'),'hex'),qr_token_plain=tok,revoked=false where team_id=p_team and checkpoint_order=p_order;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'regenerate_token',jsonb_build_object('team',p_team,'order',p_order)); end$$;
create function revoke_token(p_team uuid,p_order int,p_revoked bool) returns void language plpgsql security definer set search_path=public,extensions as $$
begin perform require_admin(); update team_routes set revoked=p_revoked where team_id=p_team and checkpoint_order=p_order;
 insert into audit_logs(actor,action,detail) values(auth.uid(),'revoke_token',jsonb_build_object('team',p_team,'order',p_order,'revoked',p_revoked)); end$$;
revoke all on function set_game_status(uuid,text),reset_team(uuid),regenerate_token(uuid,int),revoke_token(uuid,int,bool) from public;
grant execute on function set_game_status(uuid,text),reset_team(uuid),regenerate_token(uuid,int),revoke_token(uuid,int,bool) to authenticated;
alter publication supabase_realtime add table activity_log, team_progress;
alter table events add column instructions text, add column hints_enabled bool not null default true, add column victory_message text;
create or replace function get_my_state() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); t teams; ev events; p team_progress; total int; r team_routes; s stations; clue jsonb;
begin
 if tid is null then return null; end if;
 select * into t from teams where id=tid; select * into ev from events where id=t.event_id;
 select * into p from team_progress where team_id=tid; select count(*) into total from team_routes where team_id=tid;
 if p.team_id is not null and p.scanned_order>p.completed_order and p.finished_at is null then
  select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
  clue:=jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,'hint',case when ev.hints_enabled then s.hint end);
 end if;
 return jsonb_build_object('team',t.name,'color',t.color,'event',ev.name,'status',ev.status,'completed',coalesce(p.completed_order,0),'total',total,
  'started_at',p.started_at,'finished_at',p.finished_at,'clue',clue,'victory',ev.victory_message,'instructions',ev.instructions);
end$$;
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
