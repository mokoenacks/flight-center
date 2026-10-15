-- FlightAngel price board.
-- Run this once in the Supabase SQL editor after multi-agent.sql.
-- Clients post a trip. Agents post a price, and every later price has to go lower than the lowest one on that trip.

create table if not exists public.trip_asks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  dates text not null default '',
  travellers text not null default '',
  note text not null default '',
  sample boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.trip_asks (id) on delete cascade,
  agent_id text not null,
  agent_name text not null default '',
  agency_name text not null default '',
  price integer not null check (price > 0),
  includes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bids_one_price_per_agent on public.bids (request_id, agent_id);
create index if not exists trip_asks_created_idx on public.trip_asks (created_at desc);
create index if not exists bids_request_idx on public.bids (request_id);

create or replace function public.bids_must_undercut()
returns trigger
language plpgsql
as $$
declare
  floor integer;
begin
  if tg_op = 'UPDATE' and new.price >= old.price then
    raise exception 'A new price has to be lower than your last one.';
  end if;

  select min(price) into floor
  from public.bids
  where request_id = new.request_id
    and id is distinct from new.id;

  if floor is not null and new.price >= floor then
    raise exception 'A new price has to be lower than the lowest one on this trip.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bids_undercut on public.bids;
create trigger bids_undercut
  before insert or update on public.bids
  for each row execute function public.bids_must_undercut();

alter table public.trip_asks enable row level security;
alter table public.bids enable row level security;

grant select on public.trip_asks, public.bids to anon, authenticated;
grant insert on public.trip_asks to anon, authenticated;
grant insert, update on public.bids to authenticated;

drop policy if exists "public read trip asks" on public.trip_asks;
create policy "public read trip asks" on public.trip_asks
  for select to anon, authenticated
  using (true);

drop policy if exists "anyone posts a trip" on public.trip_asks;
create policy "anyone posts a trip" on public.trip_asks
  for insert to anon, authenticated
  with check (
    sample = false
    and char_length(name) between 1 and 80
    and char_length(destination) between 1 and 80
  );

drop policy if exists "public read bids" on public.bids;
create policy "public read bids" on public.bids
  for select to anon, authenticated
  using (true);

drop policy if exists "agent posts a price" on public.bids;
create policy "agent posts a price" on public.bids
  for insert to authenticated
  with check (agent_id = public.current_agent_id());

drop policy if exists "agent lowers a price" on public.bids;
create policy "agent lowers a price" on public.bids
  for update to authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

insert into public.trip_asks (name, destination, dates, travellers, note, sample)
select 'Amahle', 'Mauritius', '12-20 December', '2 adults', 'Sample request so agents can practise a price. A week with breakfast.', true
where not exists (select 1 from public.trip_asks);

insert into public.trip_asks (name, destination, dates, travellers, note, sample)
select 'Johan', 'Cape Town', 'A long weekend in November', '1 adult', 'Sample request. A return flight from Johannesburg is enough.', true
where (select count(*) from public.trip_asks) < 2;
