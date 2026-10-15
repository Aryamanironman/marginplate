create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table orgs enable row level security;
create policy org_self on orgs for select using (id = get_current_org_id());

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  insert into orgs (name)
  values (coalesce(nullif(new.raw_user_meta_data->>'restaurant_name',''), 'My restaurant'))
  returning id into v_org;
  insert into profiles (id, org_id) values (new.id, v_org);
  return new;
end $$;

drop trigger if exists create_profile_on_signup on auth.users;
create trigger create_profile_on_signup
after insert on auth.users
for each row execute function handle_new_user();

alter table line_items        add column if not exists org_id uuid;
alter table recipe_components add column if not exists org_id uuid;
alter table jobs              add column if not exists org_id uuid;

update line_items li set org_id = i.org_id
  from invoices i where li.invoice_id = i.id and li.org_id is null;
update recipe_components rc set org_id = r.org_id
  from recipes r where rc.recipe_id = r.id and rc.org_id is null;

create trigger set_org_id_line_items
  before insert on line_items for each row execute function set_org_id();
create trigger set_org_id_recipe_components
  before insert on recipe_components for each row execute function set_org_id();
create trigger set_org_id_jobs
  before insert on jobs for each row execute function set_org_id();

create policy org_isolation_line_items on line_items for all
  using (org_id = get_current_org_id()) with check (org_id = get_current_org_id());
create policy org_isolation_recipe_components on recipe_components for all
  using (org_id = get_current_org_id()) with check (org_id = get_current_org_id());
create policy org_isolation_jobs on jobs for all
  using (org_id = get_current_org_id()) with check (org_id = get_current_org_id());

create or replace function get_current_org_id() returns uuid
language plpgsql security definer set search_path = public stable as $$
declare v uuid;
begin
  select org_id into v from profiles where id = auth.uid();
  return v;
end $$;

create or replace function set_org_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.org_id := coalesce(new.org_id, get_current_org_id());
  return new;
end $$;

alter table line_items alter column ingredient_id drop not null;
alter table line_items add column if not exists match_confidence numeric(3,2);

create policy unit_map_write on unit_map for insert to authenticated with check (true);
create policy unit_map_update on unit_map for update to authenticated using (true) with check (true);

create index if not exists idx_invoices_org           on invoices(org_id);
create index if not exists idx_invoices_supplier      on invoices(supplier_id);
create index if not exists idx_line_items_invoice     on line_items(invoice_id);
create index if not exists idx_line_items_org         on line_items(org_id);
create index if not exists idx_line_items_ingredient  on line_items(ingredient_id);
create index if not exists idx_price_history_org_ing  on price_history(org_id, ingredient_id);
create index if not exists idx_price_history_observed on price_history(observed_at);
create index if not exists idx_alerts_org             on alerts(org_id);
create index if not exists idx_recipes_org            on recipes(org_id);
create index if not exists idx_par_levels_org         on par_levels(org_id);
create index if not exists idx_profiles_org           on profiles(org_id);
create index if not exists idx_jobs_status            on jobs(status, run_after);