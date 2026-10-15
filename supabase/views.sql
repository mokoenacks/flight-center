-- Visitor counts. Run this once in the Supabase SQL editor.
-- Safe to run again. Run supabase/multi-agent.sql first if you have not already.

alter table public.agent add column if not exists user_id uuid;

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
