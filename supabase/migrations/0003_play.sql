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
