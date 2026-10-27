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
