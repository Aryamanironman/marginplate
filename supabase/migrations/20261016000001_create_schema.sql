-- Drop existing tables if any (for idempotency in dev)
-- But note: we are creating a new migration, so we don't need to drop.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: unit_map
CREATE TABLE unit_map (
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    factor NUMERIC NOT NULL,
    PRIMARY KEY (from_unit, to_unit)
);

-- Insert common unit conversions
INSERT INTO unit_map (from_unit, to_unit, factor) VALUES
    ('case', 'each', 24),   -- assuming a case of 24 each, but note: we parse from description
    ('lb', 'oz', 16),
    ('oz', 'lb', 1/16.0),
    ('kg', 'g', 1000),
    ('g', 'kg', 0.001),
    ('each', 'each', 1);

-- Table: suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT
);

-- Table: ingredients
CREATE TABLE ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    canonical_unit TEXT NOT NULL, -- e.g., 'g', 'kg', 'each', 'lb'
    category TEXT
);

-- Table: invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    image_path TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    parse_status TEXT NOT NULL DEFAULT 'pending', -- pending, parsed, failed
    ocr_confidence NUMERIC(3,2) -- between 0 and 1
);

-- Table: line_items
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    raw_description TEXT NOT NULL,
    raw_qty NUMERIC NOT NULL,
    raw_unit TEXT NOT NULL,
    canonical_qty NUMERIC NOT NULL,
    canonical_unit TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    line_total NUMERIC(10,2) NOT NULL,
    confidence NUMERIC(3,2) -- OCR confidence for this line
);

-- Table: price_history
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    unit_cost NUMERIC(10,2) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: recipes
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    menu_item_name TEXT NOT NULL,
    sale_price NUMERIC(10,2) NOT NULL
);

-- Table: recipe_components
CREATE TABLE recipe_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    qty NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    yield_factor NUMERIC NOT NULL DEFAULT 1.0 -- usable = qty * yield_factor
);

-- Table: par_levels
CREATE TABLE par_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    par_qty NUMERIC NOT NULL,
    reorder_lead_days INTEGER NOT NULL,
    avg_daily_usage NUMERIC NOT NULL,
    stock NUMERIC NOT NULL
);

-- Table: alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    type TEXT NOT NULL, -- e.g., 'creep', 'stockout'
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    dollars_impact NUMERIC(10,2) NOT NULL,
    payload JSONB, -- for storing additional data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Table: jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- e.g., 'parse_invoice', 'forecast'
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed
    attempts INTEGER NOT NULL DEFAULT 0,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL
);

-- Now, set up RLS and triggers.

-- First, enable RLS on all tables
ALTER TABLE unit_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE par_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create a function to get the org_id from the auth.jwt() via the profiles table
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id
    FROM profiles
    WHERE id = auth.uid();
    RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to set org_id on BEFORE INSERT
CREATE OR REPLACE FUNCTION set_org_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.org_id := COALESCE(NEW.org_id, get_current_org_id());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create BEFORE INSERT triggers for each table (except unit_map and profiles? We'll do for all that have org_id)
-- Note: unit_map does not have org_id, so skip.
-- profiles: we set org_id on insert, but we don't want to override? We'll do it.

DO $$
DECLARE
    tables TEXT[] := ARRAY['suppliers', 'ingredients', 'invoices', 'line_items', 'price_history', 'recipes', 'recipe_components', 'par_levels', 'alerts', 'jobs', 'profiles'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE TRIGGER set_org_id_%I
            BEFORE INSERT ON %I
            FOR EACH ROW
            EXECUTE FUNCTION set_org_id();
        ', t, t);
    END LOOP;
END $$;

-- Now, create RLS policies for each table (except unit_map) to only allow access to the current org
DO $$
DECLARE
    tables TEXT[] := ARRAY['suppliers', 'ingredients', 'invoices', 'line_items', 'price_history', 'recipes', 'recipe_components', 'par_levels', 'alerts', 'jobs', 'profiles'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE POLICY org_isolation_on_%I
            ON %I
            FOR ALL
            USING (org_id = get_current_org_id());
        ', t, t);
    END LOOP;
END $$;

-- For unit_map, we don't have org_id, so we allow everyone to read (it's a reference table)
CREATE POLICY unit_map_read_only
ON unit_map
FOR SELECT
USING (TRUE);

-- Note: We are not allowing insert/update/delete on unit_map via RLS, but we can adjust if needed.

-- We'll also set up the profiles table to be insertable by the user on sign up (via a trigger in auth? We'll do it in the app)

-- We'll also create a trigger to create a profile when a user signs up
-- This is done in the auth schema, but we can do it via a trigger on auth.users?
-- Alternatively, we can handle it in the app. We'll do it in the app for simplicity.

-- However, note that the spec says we need a profiles table holding org_id.

-- We'll leave it to the app to create the profile on sign up.

-- We'll also create a function to create a profile for a new user
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, org_id)
    VALUES (NEW.id, '00000000-0000-0000-0000-000000000000'::uuid); -- placeholder, will be updated by the app
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER create_profile_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
WHEN (NEW.email IS NOT NULL)
EXECUTE FUNCTION create_profile_for_new_user();

-- Note: The placeholder org_id will be updated by the app when we assign the user to an org.

-- We'll also need to set up the auth settings for email confirmation.
-- We'll do that via the Supabase CLI later.

-- That's the end of the migration.