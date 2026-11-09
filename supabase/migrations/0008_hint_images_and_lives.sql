-- 1. Add hint_image_url to stations table
alter table stations add column if not exists hint_image_url text;

-- 2. Update request_hint to limit each team to 2 hint lives
create or replace function request_hint() returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); p team_progress; ev events; r team_routes; s stations; used_hints int;
begin
 if tid is null then raise exception 'not_a_team_member'; end if;
 select e.* into ev from events e join teams t on t.event_id=e.id where t.id=tid;
 if ev.status<>'live' then raise exception 'game_not_live'; end if;
 if not ev.hints_enabled then raise exception 'hints_off'; end if;
 select * into p from team_progress where team_id=tid;
 if not found or p.scanned_order<>p.completed_order+1 then raise exception 'scan_first'; end if;
 select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
 if s.hint is null and s.hint_image_url is null then return jsonb_build_object('hint',null,'hint_image_url',null); end if;

 -- Enforce 2 hint lives per team
 if not exists(select 1 from hint_uses where team_id=tid and checkpoint_order=p.scanned_order) then
  select count(*) into used_hints from hint_uses where team_id=tid;
  if used_hints >= 2 then
   raise exception 'no_hint_lives_left';
  end if;
  insert into hint_uses(team_id,checkpoint_order) values(tid,p.scanned_order);
  insert into activity_log(team_id,kind,checkpoint_order) values(tid,'hint',p.scanned_order);
 end if;
 return jsonb_build_object('hint',s.hint,'hint_image_url',s.hint_image_url);
end$$;

grant execute on function request_hint() to authenticated;

-- 3. Update get_my_state to track hint_lives_left and return hint_image_url
create or replace function get_my_state() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); t teams; ev events; p team_progress; total int; r team_routes; s stations; clue jsonb; used_hints int; has_hint bool; hint_lives int;
begin
 if tid is null then return null; end if;
 select * into t from teams where id=tid; select * into ev from events where id=t.event_id;
 select * into p from team_progress where team_id=tid; select count(*) into total from team_routes where team_id=tid;
 select count(*) into used_hints from hint_uses where team_id=tid;
 hint_lives := greatest(0, 2 - used_hints);
 if p.team_id is not null and p.scanned_order>p.completed_order and p.finished_at is null then
  select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
  has_hint := exists(select 1 from hint_uses h where h.team_id=tid and h.checkpoint_order=p.scanned_order);
  clue:=jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,
   'image_url',s.image_url,
   'hint',case when ev.hints_enabled and has_hint then s.hint end,
   'hint_image_url',case when ev.hints_enabled and has_hint then s.hint_image_url end,
   'hint_available',ev.hints_enabled and (s.hint is not null or s.hint_image_url is not null) and (has_hint or hint_lives > 0),
   'has_station_hint',ev.hints_enabled and (s.hint is not null or s.hint_image_url is not null),
   'hint_penalty',ev.hint_penalty,
   'hint_lives_left',hint_lives);
 end if;
 return jsonb_build_object('team',t.name,'color',t.color,'event',ev.name,'status',ev.status,'completed',coalesce(p.completed_order,0),'total',total,
  'started_at',p.started_at,'finished_at',p.finished_at,'clue',clue,'victory',ev.victory_message,'instructions',ev.instructions,
  'hint_lives_left',hint_lives,'hint_lives_total',2,
  'deadline',case when ev.time_limit_minutes is not null and p.started_at is not null and p.finished_at is null then p.started_at+make_interval(mins=>ev.time_limit_minutes) end);
end$$;

grant execute on function get_my_state() to authenticated;

NOTIFY pgrst, 'reload schema';
