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
