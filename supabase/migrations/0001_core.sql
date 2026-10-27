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
