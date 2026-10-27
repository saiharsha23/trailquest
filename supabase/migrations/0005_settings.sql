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
