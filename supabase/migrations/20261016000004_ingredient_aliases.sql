create table ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  supplier_id uuid not null references suppliers(id),
  raw_description text not null,
  ingredient_id uuid not null references ingredients(id),
  created_at timestamptz not null default now(),
  unique (org_id, supplier_id, raw_description)
);
alter table ingredient_aliases enable row level security;
create trigger set_org_id_ingredient_aliases
  before insert on ingredient_aliases for each row execute function set_org_id();
create policy org_isolation_ingredient_aliases on ingredient_aliases for all
  using (org_id = get_current_org_id()) with check (org_id = get_current_org_id());
create index if not exists idx_aliases_lookup
  on ingredient_aliases(org_id, supplier_id, raw_description);