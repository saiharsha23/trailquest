-- Add image_url to stations table
alter table stations add column if not exists image_url text;

-- Create storage bucket for clues
insert into storage.buckets (id, name, public)
values ('clues', 'clues', true)
on conflict (id) do update set public = true;

-- Policies for public reading of clue images
drop policy if exists "Public Access to Clues" on storage.objects;
create policy "Public Access to Clues" on storage.objects for select using (bucket_id = 'clues');

-- Policies for authenticated admins to upload/manage clue images
drop policy if exists "Admins can upload clue images" on storage.objects;
create policy "Admins can upload clue images" on storage.objects for insert with check (bucket_id = 'clues' and auth.role() = 'authenticated');

drop policy if exists "Admins can update clue images" on storage.objects;
create policy "Admins can update clue images" on storage.objects for update using (bucket_id = 'clues' and auth.role() = 'authenticated');

drop policy if exists "Admins can delete clue images" on storage.objects;
create policy "Admins can delete clue images" on storage.objects for delete using (bucket_id = 'clues' and auth.role() = 'authenticated');

-- Update get_my_state to include image_url
create or replace function get_my_state() returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare tid uuid:=my_team(); t teams; ev events; p team_progress; total int; r team_routes; s stations; clue jsonb;
begin
 if tid is null then return null; end if;
 select * into t from teams where id=tid; select * into ev from events where id=t.event_id;
 select * into p from team_progress where team_id=tid; select count(*) into total from team_routes where team_id=tid;
 if p.team_id is not null and p.scanned_order>p.completed_order and p.finished_at is null then
  select * into r from team_routes where team_id=tid and checkpoint_order=p.scanned_order; select * into s from stations where id=r.station_id;
  clue:=jsonb_build_object('checkpoint',r.checkpoint_order,'title',s.clue_title,'clue',s.clue_text,
   'image_url',s.image_url,
   'hint',case when ev.hints_enabled and exists(select 1 from hint_uses h where h.team_id=tid and h.checkpoint_order=p.scanned_order) then s.hint end,
   'hint_available',ev.hints_enabled and s.hint is not null,'hint_penalty',ev.hint_penalty);
 end if;
 return jsonb_build_object('team',t.name,'color',t.color,'event',ev.name,'status',ev.status,'completed',coalesce(p.completed_order,0),'total',total,
  'started_at',p.started_at,'finished_at',p.finished_at,'clue',clue,'victory',ev.victory_message,'instructions',ev.instructions,
  'deadline',case when ev.time_limit_minutes is not null and p.started_at is not null and p.finished_at is null then p.started_at+make_interval(mins=>ev.time_limit_minutes) end);
end$$;

NOTIFY pgrst, 'reload schema';

