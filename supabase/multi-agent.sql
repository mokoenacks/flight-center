-- Run this once in the Supabase SQL editor.
-- It lets each signed-in consultant own a customer link, offers, campaigns, and quotes.

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
