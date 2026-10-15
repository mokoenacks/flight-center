-- FlightAngel
-- Run this whole script once in the Supabase SQL editor.
--
-- After it succeeds:
-- 1. Authentication → Users → Add user. Choose an email and password for yourself.
-- 2. Project Settings → API. Copy the Project URL and the anon public key.
-- 3. In the project folder, create a file named .env with:
--      VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
--      VITE_SUPABASE_ANON_KEY=your_anon_public_key
-- 4. Restart FlightAngel, open http://localhost:5173/#/admin, and sign in.
--    The first sign-in copies this computer's page into the database.
--
-- Customers can read the profile, offers, and campaigns.
-- Customers can add a quote. Only a signed-in agent can read or change quotes.

create extension if not exists pgcrypto;

create table if not exists public.agent (
  id text primary key default 'desk' check (id = 'desk'),
  agency_name text not null default '',
  agent_name text not null default '',
  tagline text not null default '',
  city text not null default '',
  phone text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  bio text not null default '',
  trust_line text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  linkedin text not null default '',
  facebook text not null default '',
  lead_webhook text not null default '',
  preview boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id text primary key,
  destination text not null,
  country text not null default '',
  kind text not null check (kind in ('flight', 'holiday', 'tour', 'cruise', 'car')),
  price_from integer not null check (price_from >= 0),
  nights text not null default '',
  blurb text not null default '',
  includes text not null default '',
  depart_from text not null default '',
  travel_window text not null default '',
  featured boolean not null default false,
  palette text not null default 'lagoon' check (palette in ('lagoon', 'dusk', 'alpine', 'spice', 'city', 'vine')),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key,
  offer_id text not null,
  strategy_id text not null check (strategy_id in (
    'price-anchor',
    'quote-magnet',
    'dream-then-plan',
    'package-ladder',
    'social-proof',
    'seasonal-wave',
    'speed-to-lead'
  )),
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready', 'live')),
  scheduled_for date not null,
  automation_key text not null default '',
  master_edited boolean not null default false,
  master jsonb not null default '{}'::jsonb,
  channels jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  from_place text not null default '',
  to_place text not null default '',
  dates text not null default '',
  travellers text not null default '',
  kind text not null default 'unsure' check (kind in ('flight', 'holiday', 'tour', 'cruise', 'car', 'unsure')),
  notes text not null default '',
  source text not null default '',
  stage text not null default 'new' check (stage in ('new', 'contacted', 'quoted', 'booked', 'lost')),
  follow_ups jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists offers_sort_idx on public.offers (sort_order);
create index if not exists campaigns_sort_idx on public.campaigns (sort_order);
create index if not exists campaigns_automation_key_idx on public.campaigns (automation_key);
create index if not exists leads_created_idx on public.leads (created_at desc);

insert into public.agent (
  id,
  agency_name,
  agent_name,
  tagline,
  city,
  bio,
  trust_line,
  preview
)
values (
  'desk',
  'My Travel Desk',
  'Travel consultant',
  'Flights, holidays, and cruises — quoted by a person.',
  'Johannesburg',
  'Say what you are good at. Example: family beach holidays, first cruises, and trips leaving Johannesburg.',
  'You get one consultant from the first message until the tickets are sent.',
  true
)
on conflict (id) do nothing;

alter table public.agent enable row level security;
alter table public.offers enable row level security;
alter table public.campaigns enable row level security;
alter table public.leads enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.agent, public.offers, public.campaigns to anon, authenticated;
grant insert, update, delete on public.offers, public.campaigns to authenticated;
grant insert, update on public.agent to authenticated;
grant insert on public.leads to anon, authenticated;
grant select, update, delete on public.leads to authenticated;

drop policy if exists "public read agent" on public.agent;
create policy "public read agent" on public.agent
  for select to anon, authenticated
  using (true);

drop policy if exists "agent inserts agent" on public.agent;
create policy "agent inserts agent" on public.agent
  for insert to authenticated
  with check (id = 'desk');

drop policy if exists "agent updates agent" on public.agent;
create policy "agent updates agent" on public.agent
  for update to authenticated
  using (true)
  with check (id = 'desk');

drop policy if exists "public read offers" on public.offers;
create policy "public read offers" on public.offers
  for select to anon, authenticated
  using (true);

drop policy if exists "agent writes offers" on public.offers;
create policy "agent writes offers" on public.offers
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "public read campaigns" on public.campaigns;
create policy "public read campaigns" on public.campaigns
  for select to anon, authenticated
  using (true);

drop policy if exists "agent writes campaigns" on public.campaigns;
create policy "agent writes campaigns" on public.campaigns
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists "anyone adds a quote" on public.leads;
create policy "anyone adds a quote" on public.leads
  for insert to anon, authenticated
  with check (char_length(name) between 1 and 160);

drop policy if exists "agent reads quotes" on public.leads;
create policy "agent reads quotes" on public.leads
  for select to authenticated
  using (true);

drop policy if exists "agent updates quotes" on public.leads;
create policy "agent updates quotes" on public.leads
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "agent deletes quotes" on public.leads;
create policy "agent deletes quotes" on public.leads
  for delete to authenticated
  using (true);

alter table public.leads replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
exception
  when undefined_object then
    null;
end $$;

-- Multiple agents. Safe to run again on a project that already has the tables above.
alter table public.agent drop constraint if exists agent_id_check;
alter table public.agent alter column id drop default;
alter table public.agent add column if not exists user_id uuid;
alter table public.agent add column if not exists slug text;
alter table public.offers add column if not exists agent_id text;
alter table public.campaigns add column if not exists agent_id text;
alter table public.leads add column if not exists agent_id text;
alter table public.leads add column if not exists emailed_at timestamptz;

update public.agent set slug = 'desk' where id = 'desk' and (slug is null or slug = '');
update public.offers set agent_id = 'desk' where agent_id is null;
update public.campaigns set agent_id = 'desk' where agent_id is null;
update public.leads set agent_id = 'desk' where agent_id is null;

create unique index if not exists agent_user_id_key on public.agent (user_id);
create unique index if not exists agent_slug_key on public.agent (slug);
create index if not exists offers_agent_idx on public.offers (agent_id);
create index if not exists campaigns_agent_idx on public.campaigns (agent_id);
create index if not exists leads_agent_idx on public.leads (agent_id);

alter table public.agent drop constraint if exists agent_slug_format;
alter table public.agent add constraint agent_slug_format check (slug is null or slug ~ '^[a-z0-9-]{3,40}$');

create or replace function public.current_agent_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.agent where user_id = auth.uid() limit 1
$$;

revoke all on function public.current_agent_id() from public;
revoke all on function public.current_agent_id() from anon;
grant execute on function public.current_agent_id() to authenticated;

drop policy if exists "agent inserts agent" on public.agent;
create policy "agent inserts agent" on public.agent
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "agent updates agent" on public.agent;
create policy "agent updates agent" on public.agent
  for update to authenticated
  using (user_id is null or user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "agent writes offers" on public.offers;
create policy "agent writes offers" on public.offers
  for all to authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists "public read campaigns" on public.campaigns;
create policy "public read campaigns" on public.campaigns
  for select to anon, authenticated
  using (status in ('ready', 'live'));

drop policy if exists "agent reads own campaigns" on public.campaigns;
create policy "agent reads own campaigns" on public.campaigns
  for select to authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists "agent writes campaigns" on public.campaigns;
create policy "agent writes campaigns" on public.campaigns
  for all to authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists "anyone adds a quote" on public.leads;
create policy "anyone adds a quote" on public.leads
  for insert to anon, authenticated
  with check (
    char_length(name) between 1 and 160
    and agent_id is not null
    and exists (select 1 from public.agent where id = agent_id)
  );

drop policy if exists "agent reads quotes" on public.leads;
create policy "agent reads quotes" on public.leads
  for select to authenticated
  using (agent_id = public.current_agent_id());

drop policy if exists "agent updates quotes" on public.leads;
create policy "agent updates quotes" on public.leads
  for update to authenticated
  using (agent_id = public.current_agent_id())
  with check (agent_id = public.current_agent_id());

drop policy if exists "agent deletes quotes" on public.leads;
create policy "agent deletes quotes" on public.leads
  for delete to authenticated
  using (agent_id = public.current_agent_id());

-- Visitor counts. The same script is in supabase/views.sql if this part was not run yet.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  path text not null,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  constraint page_views_path_check check (path in ('home', 'terms', 'customer')),
  constraint page_views_visitor_check check (char_length(visitor_id) between 8 and 80)
);

create index if not exists page_views_agent_idx on public.page_views (agent_id, created_at desc);
create index if not exists page_views_path_idx on public.page_views (path, created_at desc);

alter table public.page_views enable row level security;

revoke all on table public.page_views from public;
revoke all on table public.page_views from anon;
revoke all on table public.page_views from authenticated;
grant insert on table public.page_views to anon, authenticated;

drop policy if exists "anyone records a page view" on public.page_views;
create policy "anyone records a page view"
on public.page_views
for insert
to anon, authenticated
with check (
  agent_id is null
  or exists (select 1 from public.agent where id = agent_id)
);

create or replace function public.view_report()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'page_views', (
      select count(*)
      from public.page_views
      where agent_id = public.current_agent_id()
        and path = 'customer'
    ),
    'page_visitors', (
      select count(distinct visitor_id)
      from public.page_views
      where agent_id = public.current_agent_id()
        and path = 'customer'
    ),
    'home_views', (select count(*) from public.page_views where path = 'home'),
    'terms_views', (select count(*) from public.page_views where path = 'terms'),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'views', views) order by day), '[]'::jsonb)
      from (
        select to_char((created_at at time zone 'Africa/Johannesburg')::date, 'YYYY-MM-DD') as day,
               count(*) as views
        from public.page_views
        where agent_id = public.current_agent_id()
          and path = 'customer'
          and (created_at at time zone 'Africa/Johannesburg')::date
            >= (now() at time zone 'Africa/Johannesburg')::date - 6
        group by 1
      ) recent
    )
  );
$$;

revoke all on function public.view_report() from public;
revoke all on function public.view_report() from anon;
grant execute on function public.view_report() to authenticated;
