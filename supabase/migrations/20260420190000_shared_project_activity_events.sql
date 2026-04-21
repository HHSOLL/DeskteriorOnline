create table if not exists public.shared_project_activity_events (
  id uuid primary key default gen_random_uuid(),
  shared_project_id uuid not null references public.shared_projects(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'product_focus')),
  asset_id text,
  source text,
  session_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists shared_project_activity_events_shared_project_id_created_at_idx
  on public.shared_project_activity_events(shared_project_id, created_at desc);

create unique index if not exists shared_project_activity_events_view_dedupe_idx
  on public.shared_project_activity_events(shared_project_id, session_key)
  where event_type = 'view';

create unique index if not exists shared_project_activity_events_focus_dedupe_idx
  on public.shared_project_activity_events(shared_project_id, asset_id, session_key)
  where event_type = 'product_focus' and asset_id is not null;

alter table public.shared_project_activity_events enable row level security;
