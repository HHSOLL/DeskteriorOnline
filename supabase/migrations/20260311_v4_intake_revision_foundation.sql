-- DeskteriorOnline v4 foundation: intake sessions, unified revisions, provenance links

create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  input_kind text not null default 'upload' check (input_kind in ('upload', 'catalog_search', 'remediation')),
  status text not null default 'created' check (
    status in (
      'created',
      'uploading',
      'resolving',
      'disambiguation_required',
      'queued',
      'analyzing',
      'review_required',
      'resolved_reuse',
      'resolved_generated',
      'finalizing',
      'failed',
      'expired'
    )
  ),
  version int not null default 0,
  declared_apartment_name text,
  declared_type_name text,
  declared_region text,
  file_name text,
  mime_type text,
  object_path text,
  file_sha256 text,
  file_phash text,
  width int,
  height int,
  resolution_payload jsonb not null default '{}'::jsonb,
  remediation_project_id uuid references public.projects(id) on delete set null,
  generated_floorplan_id uuid,
  selected_layout_revision_id uuid,
  finalized_project_id uuid,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intake_sessions_owner_id_idx on public.intake_sessions(owner_id, created_at desc);
create index if not exists intake_sessions_status_idx on public.intake_sessions(status, updated_at desc);
create index if not exists intake_sessions_object_path_idx on public.intake_sessions(object_path);

create table if not exists public.housing_complexes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  region text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists housing_complexes_normalized_name_idx on public.housing_complexes(normalized_name);

create table if not exists public.layout_families (
  id uuid primary key default gen_random_uuid(),
  housing_complex_id uuid not null references public.housing_complexes(id) on delete cascade,
  family_code text not null,
  display_name text not null,
  dedicated_area_m2 numeric(8, 2),
  supply_area_m2 numeric(8, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists layout_families_complex_code_idx on public.layout_families(housing_complex_id, family_code);

create table if not exists public.layout_variants (
  id uuid primary key default gen_random_uuid(),
  layout_family_id uuid not null references public.layout_families(id) on delete cascade,
  variant_code text not null,
  display_name text not null,
  is_mirror boolean not null default false,
  option_flags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists layout_variants_family_code_idx on public.layout_variants(layout_family_id, variant_code);

create table if not exists public.source_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  source_kind text not null check (source_kind in ('user_upload', 'partner_licensed', 'catalog_seed', 'derived_preview')),
  license_status text not null check (license_status in ('private_temp', 'user_opt_in', 'partner_licensed', 'blocked')),
  consent_version text,
  promotion_consent boolean not null default false,
  privacy_state text not null check (privacy_state in ('private_temp', 'candidate_seed', 'licensed_catalog', 'deleted')),
  provenance_status text not null check (provenance_status in ('unverified', 'verified', 'withdrawn', 'blocked')),
  storage_bucket text,
  storage_path text,
  checksum_sha256 text,
  mime_type text,
  width int,
  height int,
  redaction_status text not null default 'pending' check (redaction_status in ('pending', 'clean', 'redacted', 'blocked')),
  retention_expires_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_assets_owner_id_idx on public.source_assets(owner_id, created_at desc);
create index if not exists source_assets_sha256_idx on public.source_assets(checksum_sha256);
create index if not exists source_assets_storage_path_idx on public.source_assets(storage_path);

create table if not exists public.layout_revisions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('canonical', 'candidate', 'private_generated')),
  verification_status text not null check (verification_status in ('unverified', 'verified', 'rejected', 'blocked')),
  layout_variant_id uuid references public.layout_variants(id) on delete set null,
  representative_source_asset_id uuid references public.source_assets(id) on delete set null,
  created_from_intake_session_id uuid references public.intake_sessions(id) on delete set null,
  parent_revision_id uuid references public.layout_revisions(id) on delete set null,
  supersedes_revision_id uuid references public.layout_revisions(id) on delete set null,
  promoted_from_revision_id uuid references public.layout_revisions(id) on delete set null,
  demoted_from_revision_id uuid references public.layout_revisions(id) on delete set null,
  geometry_json jsonb not null default '{}'::jsonb,
  topology_hash text,
  room_graph_hash text,
  geometry_hash text not null,
  geometry_schema_version int not null default 1,
  repair_engine_version text,
  scene_builder_version text,
  derived_scene_json jsonb not null default '{}'::jsonb,
  derived_nav_json jsonb not null default '{}'::jsonb,
  derived_camera_json jsonb not null default '{}'::jsonb,
  derived_from_geometry_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists layout_revisions_geometry_hash_idx on public.layout_revisions(geometry_hash);
create index if not exists layout_revisions_variant_idx on public.layout_revisions(layout_variant_id, created_at desc);
create index if not exists layout_revisions_scope_status_idx on public.layout_revisions(scope, verification_status, created_at desc);
create index if not exists layout_revisions_topology_hash_idx on public.layout_revisions(topology_hash);
create index if not exists layout_revisions_room_graph_hash_idx on public.layout_revisions(room_graph_hash);

alter table public.intake_sessions
  drop constraint if exists intake_sessions_selected_layout_revision_id_fkey;
alter table public.intake_sessions
  add constraint intake_sessions_selected_layout_revision_id_fkey
  foreign key (selected_layout_revision_id) references public.layout_revisions(id) on delete set null;

create table if not exists public.revision_source_links (
  revision_id uuid not null references public.layout_revisions(id) on delete cascade,
  source_asset_id uuid not null references public.source_assets(id) on delete cascade,
  link_role text not null check (link_role in ('primary', 'supporting', 'derived_from')),
  provenance_status text not null check (provenance_status in ('unverified', 'verified', 'withdrawn', 'blocked')),
  consent_basis text,
  added_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  primary key (revision_id, source_asset_id, link_role)
);

create index if not exists revision_source_links_source_idx on public.revision_source_links(source_asset_id, added_at desc);

create table if not exists public.catalog_search_index (
  id uuid primary key default gen_random_uuid(),
  housing_complex_id uuid references public.housing_complexes(id) on delete cascade,
  layout_family_id uuid references public.layout_families(id) on delete cascade,
  layout_variant_id uuid references public.layout_variants(id) on delete cascade,
  layout_revision_id uuid references public.layout_revisions(id) on delete cascade,
  apartment_name text not null,
  type_name text not null,
  region text,
  area_label text,
  variant_label text,
  normalized_apartment_name text not null,
  normalized_type_name text not null,
  normalized_region text,
  preview_image_path text,
  verified boolean not null default false,
  blocked boolean not null default false,
  match_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_search_index_lookup_idx
  on public.catalog_search_index(normalized_apartment_name, normalized_type_name, coalesce(normalized_region, ''));
create index if not exists catalog_search_index_revision_idx on public.catalog_search_index(layout_revision_id);

create table if not exists public.floorplan_match_events (
  id uuid primary key default gen_random_uuid(),
  intake_session_id uuid not null references public.intake_sessions(id) on delete cascade,
  candidate_revision_id uuid references public.layout_revisions(id) on delete set null,
  candidate_variant_id uuid references public.layout_variants(id) on delete set null,
  decision text not null check (
    decision in ('auto_reuse', 'disambiguation_required', 'queued', 'manual_select', 'negative_feedback', 'failed')
  ),
  confidence numeric(6, 4),
  signals jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists floorplan_match_events_session_idx on public.floorplan_match_events(intake_session_id, created_at desc);
create index if not exists floorplan_match_events_candidate_idx on public.floorplan_match_events(candidate_revision_id, created_at desc);

alter table public.projects
  add column if not exists source_layout_revision_id uuid references public.layout_revisions(id) on delete set null,
  add column if not exists resolution_state text check (resolution_state in ('reused', 'generated', 'reuse_invalidated')),
  add column if not exists created_from_intake_session_id uuid references public.intake_sessions(id) on delete set null;

create unique index if not exists projects_created_from_intake_session_id_idx on public.projects(created_from_intake_session_id)
  where created_from_intake_session_id is not null;

alter table public.intake_sessions
  drop constraint if exists intake_sessions_finalized_project_id_fkey;
alter table public.intake_sessions
  add constraint intake_sessions_finalized_project_id_fkey
  foreign key (finalized_project_id) references public.projects(id) on delete set null;

alter table public.floorplans
  add column if not exists intake_session_id uuid references public.intake_sessions(id) on delete cascade;

alter table public.floorplans
  alter column project_id drop not null;

alter table public.floorplans
  drop constraint if exists floorplans_status_check;
alter table public.floorplans
  add constraint floorplans_status_check check (status in ('queued', 'running', 'retrying', 'review_required', 'succeeded', 'failed'));

alter table public.floorplans
  drop constraint if exists floorplans_project_or_intake_check;
alter table public.floorplans
  add constraint floorplans_project_or_intake_check check (project_id is not null or intake_session_id is not null);

create index if not exists floorplans_intake_session_id_idx on public.floorplans(intake_session_id);

-- updated_at triggers
do $$
begin
  execute 'drop trigger if exists set_intake_sessions_updated_at on public.intake_sessions';
  execute 'create trigger set_intake_sessions_updated_at before update on public.intake_sessions for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_housing_complexes_updated_at on public.housing_complexes';
  execute 'create trigger set_housing_complexes_updated_at before update on public.housing_complexes for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_layout_families_updated_at on public.layout_families';
  execute 'create trigger set_layout_families_updated_at before update on public.layout_families for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_layout_variants_updated_at on public.layout_variants';
  execute 'create trigger set_layout_variants_updated_at before update on public.layout_variants for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_source_assets_updated_at on public.source_assets';
  execute 'create trigger set_source_assets_updated_at before update on public.source_assets for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_layout_revisions_updated_at on public.layout_revisions';
  execute 'create trigger set_layout_revisions_updated_at before update on public.layout_revisions for each row execute procedure public.set_updated_at()';
  execute 'drop trigger if exists set_catalog_search_index_updated_at on public.catalog_search_index';
  execute 'create trigger set_catalog_search_index_updated_at before update on public.catalog_search_index for each row execute procedure public.set_updated_at()';
end $$;

-- RLS
alter table public.intake_sessions enable row level security;
alter table public.source_assets enable row level security;
alter table public.layout_revisions enable row level security;
alter table public.revision_source_links enable row level security;
alter table public.catalog_search_index enable row level security;
alter table public.floorplan_match_events enable row level security;

-- intake sessions
create policy "Intake sessions are viewable by owner"
on public.intake_sessions for select
using (owner_id = auth.uid());

create policy "Intake sessions are insertable by owner"
on public.intake_sessions for insert
with check (owner_id = auth.uid());

create policy "Intake sessions are updatable by owner"
on public.intake_sessions for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- source assets
create policy "Source assets are viewable by owner"
on public.source_assets for select
using (owner_id = auth.uid());

create policy "Source assets are insertable by owner"
on public.source_assets for insert
with check (owner_id = auth.uid());

create policy "Source assets are updatable by owner"
on public.source_assets for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- layout revisions
create policy "Layout revisions are viewable by owner or published"
on public.layout_revisions for select
using (
  (scope = 'canonical' and verification_status = 'verified')
  or exists (
    select 1 from public.intake_sessions s
    where s.id = layout_revisions.created_from_intake_session_id
      and s.owner_id = auth.uid()
  )
);

-- revision source links
create policy "Revision source links are viewable by linked owner"
on public.revision_source_links for select
using (
  exists (
    select 1
    from public.layout_revisions r
    join public.intake_sessions s on s.id = r.created_from_intake_session_id
    where r.id = revision_source_links.revision_id
      and s.owner_id = auth.uid()
  )
);

-- catalog search index
create policy "Catalog search index is viewable when publishable"
on public.catalog_search_index for select
using (verified = true and blocked = false);

-- floorplan match events
create policy "Floorplan match events are viewable by intake owner"
on public.floorplan_match_events for select
using (
  exists (
    select 1 from public.intake_sessions s
    where s.id = floorplan_match_events.intake_session_id
      and s.owner_id = auth.uid()
  )
);

create policy "Floorplan match events are insertable by intake owner"
on public.floorplan_match_events for insert
with check (
  exists (
    select 1 from public.intake_sessions s
    where s.id = floorplan_match_events.intake_session_id
      and s.owner_id = auth.uid()
  )
);

-- extend floorplan policies to intake owner
drop policy if exists "Floorplans are viewable by project owner" on public.floorplans;
drop policy if exists "Floorplans are viewable by project or intake owner" on public.floorplans;
create policy "Floorplans are viewable by project or intake owner"
on public.floorplans for select
using (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.intake_sessions s
    where s.id = floorplans.intake_session_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplans are insertable by project owner" on public.floorplans;
drop policy if exists "Floorplans are insertable by project or intake owner" on public.floorplans;
create policy "Floorplans are insertable by project or intake owner"
on public.floorplans for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.intake_sessions s
    where s.id = floorplans.intake_session_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplans are updatable by project owner" on public.floorplans;
drop policy if exists "Floorplans are updatable by project or intake owner" on public.floorplans;
create policy "Floorplans are updatable by project or intake owner"
on public.floorplans for update
using (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.intake_sessions s
    where s.id = floorplans.intake_session_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = floorplans.project_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.intake_sessions s
    where s.id = floorplans.intake_session_id
      and s.owner_id = auth.uid()
  )
);

-- extend jobs/results policies to intake owner
drop policy if exists "Jobs are viewable by project owner" on public.jobs;
drop policy if exists "Jobs are viewable by project or intake owner" on public.jobs;
create policy "Jobs are viewable by project or intake owner"
on public.jobs for select
using (
  exists (
    select 1
    from public.floorplans f
    join public.projects p on p.id = f.project_id
    where f.id = jobs.floorplan_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.floorplans f
    join public.intake_sessions s on s.id = f.intake_session_id
    where f.id = jobs.floorplan_id
      and s.owner_id = auth.uid()
  )
);

drop policy if exists "Floorplan results are viewable by project owner" on public.floorplan_results;
drop policy if exists "Floorplan results are viewable by project or intake owner" on public.floorplan_results;
create policy "Floorplan results are viewable by project or intake owner"
on public.floorplan_results for select
using (
  exists (
    select 1
    from public.floorplans f
    join public.projects p on p.id = f.project_id
    where f.id = floorplan_results.floorplan_id
      and p.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.floorplans f
    join public.intake_sessions s on s.id = f.intake_session_id
    where f.id = floorplan_results.floorplan_id
      and s.owner_id = auth.uid()
  )
);

create or replace function public.finalize_intake_session(
  p_intake_session_id uuid,
  p_owner_id uuid,
  p_name text,
  p_description text default null
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  source_layout_revision_id uuid,
  resolution_state text,
  created_from_intake_session_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.intake_sessions%rowtype;
  v_existing public.projects%rowtype;
  v_created public.projects%rowtype;
begin
  select *
    into v_session
    from public.intake_sessions
   where intake_sessions.id = p_intake_session_id
   for update;

  if not found then
    raise exception 'Intake session not found';
  end if;

  if v_session.owner_id <> p_owner_id then
    raise exception 'Unauthorized';
  end if;

  if v_session.status not in ('resolved_reuse', 'resolved_generated', 'finalizing') then
    raise exception 'Intake session is not ready to finalize';
  end if;

  if v_session.selected_layout_revision_id is null then
    raise exception 'Selected layout revision is required';
  end if;

  select *
    into v_existing
    from public.projects
   where created_from_intake_session_id = p_intake_session_id
   limit 1;

  if found then
    return query
    select
      v_existing.id,
      v_existing.owner_id,
      v_existing.name,
      v_existing.description,
      v_existing.source_layout_revision_id,
      v_existing.resolution_state,
      v_existing.created_from_intake_session_id,
      v_existing.created_at,
      v_existing.updated_at;
    return;
  end if;

  insert into public.projects (
    owner_id,
    name,
    description,
    source_layout_revision_id,
    resolution_state,
    created_from_intake_session_id
  )
  values (
    p_owner_id,
    p_name,
    p_description,
    v_session.selected_layout_revision_id,
    case when v_session.status = 'resolved_reuse' then 'reused' else 'generated' end,
    p_intake_session_id
  )
  returning * into v_created;

  if v_session.generated_floorplan_id is not null then
    update public.floorplans
       set project_id = v_created.id,
           updated_at = now()
     where id = v_session.generated_floorplan_id
       and project_id is null;
  end if;

  update public.intake_sessions
     set finalized_project_id = v_created.id,
         updated_at = now()
   where id = p_intake_session_id;

  return query
  select
    v_created.id,
    v_created.owner_id,
    v_created.name,
    v_created.description,
    v_created.source_layout_revision_id,
    v_created.resolution_state,
    v_created.created_from_intake_session_id,
    v_created.created_at,
    v_created.updated_at;
end;
$$;

revoke all on function public.finalize_intake_session(uuid, uuid, text, text) from public;
grant execute on function public.finalize_intake_session(uuid, uuid, text, text) to service_role;
