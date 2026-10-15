require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function seedReference() {
  // 1. Get or create org "Casa Maria"
  let orgId = null;
  const { data: orgData, error: orgError } = await supabase
    .from('orgs')
    .select('id')
    .eq('name', 'Casa Maria')
    .single();

  if (orgError && orgError.code !== 'PGRST116') {
    console.error('Error fetching org:', orgError);
    return;
  }

  if (orgData) {
    orgId = orgData.id;
  } else {
    const { data: newOrgData, error: insertOrgError } = await supabase
      .from('orgs')
      .insert({ name: 'Casa Maria' })
      .select('id')
      .single();

    if (insertOrgError) {
      console.error('Error creating org:', insertOrgError);
      return;
    }
    orgId = newOrgData.id;
  }
  console.log('Org ID:', orgId);

  // 2. Update profiles of test users to this org
  const userIds = [
    'f53a6ed7-d106-4ae3-a146-8fe27ed10d1d', // maria@test.dev
    'd198d281-179e-4cd7-a8d4-4a736f8aa000'  // owner2@test.dev
  ];

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ org_id: orgId })
    .in('id', userIds);

  if (profileError) {
    console.error('Error updating profiles:', profileError);
    return;
  }

  // 3. Clear existing suppliers and ingredients for this org (idempotent seed)
  const { error: delSupError } = await supabase
    .from('suppliers')
    .delete()
    .eq('org_id', orgId);

  if (delSupError) {
    console.error('Error deleting suppliers:', delSupError);
    return;
  }

  const { error: delIngError } = await supabase
    .from('ingredients')
    .delete()
    .eq('org_id', orgId);

  if (delIngError) {
    console.error('Error deleting ingredients:', delIngError);
    return;
  }

  // 4. 4 suppliers
  const suppliers = [
    { name: 'Sysco', org_id: orgId },
    { name: 'US Foods', org_id: orgId },
    { name: 'Local Produce Co', org_id: orgId },
    { name: 'Restaurant Depot', org_id: orgId },
  ];

  const { error: supplierError } = await supabase
    .from('suppliers')
    .insert(suppliers);

  if (supplierError) {
    console.error('Error seeding suppliers:', supplierError);
    return;
  }

  // 5. 20 ingredients with sensible canonical units
  const ingredients = [
    { name: 'Chicken Breast', canonical_unit: 'lb', category: 'Meat', org_id: orgId },
    { name: 'Beef Ground', canonical_unit: 'lb', category: 'Meat', org_id: orgId },
    { name: 'Pork Chop', canonical_unit: 'lb', category: 'Meat', org_id: orgId },
    { name: 'Salmon Fillet', canonical_unit: 'lb', category: 'Seafood', org_id: orgId },
    { name: 'Shrimp', canonical_unit: 'lb', category: 'Seafood', org_id: orgId },
    { name: 'Lettuce', canonical_unit: 'each', category: 'Produce', org_id: orgId },
    { name: 'Tomato', canonical_unit: 'each', category: 'Produce', org_id: orgId },
    { name: 'Onion', canonical_unit: 'lb', category: 'Produce', org_id: orgId },
    { name: 'Garlic', canonical_unit: 'each', category: 'Produce', org_id: orgId },
    { name: 'Bell Pepper', canonical_unit: 'each', category: 'Produce', org_id: orgId },
    { name: 'Rice', canonical_unit: 'lb', category: 'Pantry', org_id: orgId },
    { name: 'Beans', canonical_unit: 'lb', category: 'Pantry', org_id: orgId },
    { name: 'Flour', canonical_unit: 'lb', category: 'Pantry', org_id: orgId },
    { name: 'Sugar', canonical_unit: 'lb', category: 'Pantry', org_id: orgId },
    { name: 'Milk', canonical_unit: 'gal', category: 'Dairy', org_id: orgId },
    { name: 'Cheese', canonical_unit: 'lb', category: 'Dairy', org_id: orgId },
    { name: 'Eggs', canonical_unit: 'each', category: 'Dairy', org_id: orgId },
    { name: 'Butter', canonical_unit: 'lb', category: 'Dairy', org_id: orgId },
    { name: 'Bread', canonical_unit: 'loaf', category: 'Bakery', org_id: orgId },
    { name: 'Pasta', canonical_unit: 'lb', category: 'Pantry', org_id: orgId },
  ];

  const { error: ingredientError } = await supabase
    .from('ingredients')
    .insert(ingredients);

  if (ingredientError) {
    console.error('Error seeding ingredients:', ingredientError);
    return;
  }

  console.log('Reference data seeded successfully');
}

seedReference().catch(console.error);