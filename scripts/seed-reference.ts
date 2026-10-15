require('dotenv').config();
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Ingredient reference data: name -> { canonical_unit, category, supplier, base_price, bumped_price? }
const INGREDIENTS: Record<string, { canonical_unit: string; category: string; supplier: string; price: number; bumped?: number }> = {
  'Chicken Breast': { canonical_unit: 'lb', category: 'Meat', supplier: 'Sysco', price: 2.5, bumped: 2.85 },
  'Beef Ground':    { canonical_unit: 'lb', category: 'Meat', supplier: 'Sysco', price: 3.8, bumped: 4.35 },
  'Pork Chop':      { canonical_unit: 'lb', category: 'Meat', supplier: 'Sysco', price: 3.2 },
  'Salmon Fillet':  { canonical_unit: 'lb', category: 'Seafood', supplier: 'Sysco', price: 9.5 },
  'Shrimp':         { canonical_unit: 'lb', category: 'Seafood', supplier: 'Sysco', price: 11.0, bumped: 12.5 },
  'Lettuce':        { canonical_unit: 'each', category: 'Produce', supplier: 'Local Produce Co', price: 1.2 },
  'Tomato':         { canonical_unit: 'each', category: 'Produce', supplier: 'Local Produce Co', price: 0.8 },
  'Onion':          { canonical_unit: 'lb', category: 'Produce', supplier: 'Local Produce Co', price: 0.9 },
  'Garlic':         { canonical_unit: 'each', category: 'Produce', supplier: 'Local Produce Co', price: 0.5 },
  'Bell Pepper':    { canonical_unit: 'each', category: 'Produce', supplier: 'Local Produce Co', price: 1.5 },
  'Rice':           { canonical_unit: 'lb', category: 'Pantry', supplier: 'US Foods', price: 0.9 },
  'Beans':          { canonical_unit: 'lb', category: 'Pantry', supplier: 'US Foods', price: 1.1 },
  'Flour':          { canonical_unit: 'lb', category: 'Pantry', supplier: 'US Foods', price: 0.7 },
  'Sugar':          { canonical_unit: 'lb', category: 'Pantry', supplier: 'US Foods', price: 0.8 },
  'Pasta':          { canonical_unit: 'lb', category: 'Pantry', supplier: 'US Foods', price: 1.3 },
  'Milk':           { canonical_unit: 'gal', category: 'Dairy', supplier: 'Restaurant Depot', price: 3.5, bumped: 3.85 },
  'Cheese':         { canonical_unit: 'lb', category: 'Dairy', supplier: 'Restaurant Depot', price: 4.5, bumped: 5.0 },
  'Eggs':           { canonical_unit: 'each', category: 'Dairy', supplier: 'Restaurant Depot', price: 0.35 },
  'Butter':         { canonical_unit: 'lb', category: 'Dairy', supplier: 'Restaurant Depot', price: 4.0, bumped: 4.5 },
  'Bread':          { canonical_unit: 'loaf', category: 'Bakery', supplier: 'Restaurant Depot', price: 3.0 },
}

// Recipes: name -> { sale_price, components: [ingredient, qty, unit, yield_factor][] }
const RECIPES: Record<string, { sale_price: number; components: [string, number, string, number][] }> = {
  'Grilled Chicken Plate': {
    sale_price: 18.99,
    components: [
      ['Chicken Breast', 0.5, 'lb', 0.9],
      ['Rice', 0.25, 'lb', 1],
      ['Onion', 0.1, 'lb', 1],
      ['Lettuce', 1, 'each', 0.8],
    ],
  },
  'Beef Taco Bowl': {
    sale_price: 15.99,
    components: [
      ['Beef Ground', 0.4, 'lb', 0.85],
      ['Beans', 0.2, 'lb', 1],
      ['Tomato', 1, 'each', 1],
      ['Cheese', 0.1, 'lb', 1],
      ['Lettuce', 0.5, 'each', 0.8],
    ],
  },
  'Salmon Dinner': {
    sale_price: 24.99,
    components: [
      ['Salmon Fillet', 0.5, 'lb', 0.9],
      ['Rice', 0.25, 'lb', 1],
      ['Butter', 0.05, 'lb', 1],
    ],
  },
  'Shrimp Pasta': {
    sale_price: 19.99,
    components: [
      ['Shrimp', 0.3, 'lb', 0.85],
      ['Pasta', 0.3, 'lb', 1],
      ['Garlic', 1, 'each', 0.9],
      ['Butter', 0.05, 'lb', 1],
    ],
  },
  'Pork Chop Platter': {
    sale_price: 16.99,
    components: [
      ['Pork Chop', 0.6, 'lb', 0.8],
      ['Flour', 0.1, 'lb', 1],
      ['Eggs', 1, 'each', 0.9],
      ['Onion', 0.1, 'lb', 1],
    ],
  },
  'Garden Bowl': {
    sale_price: 13.99,
    components: [
      ['Lettuce', 1, 'each', 0.8],
      ['Tomato', 1, 'each', 1],
      ['Bell Pepper', 1, 'each', 1],
      ['Rice', 0.2, 'lb', 1],
      ['Beans', 0.15, 'lb', 1],
    ],
  },
}

// Par levels: name -> { par_qty, reorder_lead_days, avg_daily_usage, stock }
const PAR_LEVELS: Record<string, { par_qty: number; reorder_lead_days: number; avg_daily_usage: number; stock: number }> = {
  'Chicken Breast': { par_qty: 25, reorder_lead_days: 4, avg_daily_usage: 3.0, stock: 18 },
  'Beef Ground': { par_qty: 20, reorder_lead_days: 5, avg_daily_usage: 2.5, stock: 12 },
  'Pork Chop': { par_qty: 20, reorder_lead_days: 5, avg_daily_usage: 2.0, stock: 15 },
  'Salmon Fillet': { par_qty: 15, reorder_lead_days: 3, avg_daily_usage: 1.2, stock: 6 },
  'Shrimp': { par_qty: 15, reorder_lead_days: 3, avg_daily_usage: 1.5, stock: 9 },
  'Lettuce': { par_qty: 30, reorder_lead_days: 3, avg_daily_usage: 6.0, stock: 22 },
  'Tomato': { par_qty: 30, reorder_lead_days: 3, avg_daily_usage: 5.0, stock: 25 },
  'Onion': { par_qty: 25, reorder_lead_days: 4, avg_daily_usage: 3.0, stock: 20 },
  'Garlic': { par_qty: 12, reorder_lead_days: 4, avg_daily_usage: 1.0, stock: 8 },
  'Bell Pepper': { par_qty: 20, reorder_lead_days: 3, avg_daily_usage: 2.0, stock: 14 },
  'Rice': { par_qty: 40, reorder_lead_days: 6, avg_daily_usage: 4.0, stock: 30 },
  'Beans': { par_qty: 30, reorder_lead_days: 6, avg_daily_usage: 3.0, stock: 26 },
  'Flour': { par_qty: 25, reorder_lead_days: 6, avg_daily_usage: 2.0, stock: 18 },
  'Sugar': { par_qty: 20, reorder_lead_days: 6, avg_daily_usage: 1.0, stock: 15 },
  'Pasta': { par_qty: 30, reorder_lead_days: 5, avg_daily_usage: 3.0, stock: 24 },
  'Milk': { par_qty: 15, reorder_lead_days: 3, avg_daily_usage: 2.0, stock: 9 },
  'Cheese': { par_qty: 18, reorder_lead_days: 4, avg_daily_usage: 1.5, stock: 10 },
  'Eggs': { par_qty: 36, reorder_lead_days: 3, avg_daily_usage: 4.0, stock: 28 },
  'Butter': { par_qty: 12, reorder_lead_days: 4, avg_daily_usage: 1.0, stock: 7 },
  'Bread': { par_qty: 24, reorder_lead_days: 3, avg_daily_usage: 3.0, stock: 18 },
}

const SUPPLIER_NAMES = ['Sysco', 'US Foods', 'Local Produce Co', 'Restaurant Depot']

async function seedReference() {
  // 1. Get or create org "Casa Maria"
  let orgId: string | null = null
  const { data: orgData, error: orgError } = await supabase
    .from('orgs')
    .select('id')
    .eq('name', 'Casa Maria')
    .single()

  if (orgError && orgError.code !== 'PGRST116') { // PGRST116 means no rows returned
    console.error('Error fetching org:', orgError)
    return
  }

  if (orgData) {
    orgId = orgData.id
  } else {
    // Org does not exist, create it
    const { data: newOrgData, error: insertOrgError } = await supabase
      .from('orgs')
      .insert({ name: 'Casa Maria' })
      .select('id')
      .single()

    if (insertOrgError) {
      console.error('Error creating org:', insertOrgError)
      return
    }
    orgId = newOrgData.id
  }
  console.log('Org ID:', orgId)

  // 2. Update profiles of test users to this org
  // Use admin API to list users
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
  if (userError) {
    console.error('Error fetching user IDs:', userError);
    return;
  }

  const targetEmails = ['maria@test.dev', 'owner2@test.dev'];
  const userIds = users
    .filter(u => u.email && targetEmails.includes(u.email))
    .map(u => u.id);
  if (userIds.length === 0) {
    console.error('No users found for the given emails');
    return;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ org_id: orgId })
    .in('id', userIds);

  if (profileError) {
    console.error('Error updating profiles:', profileError);
    return;
  }

  // 3. Clear existing seed data for this org (idempotent)
  const clearOrder = ['recipe_components', 'recipes', 'price_history', 'par_levels', 'suppliers', 'ingredients']
  for (const table of clearOrder) {
    const { error } = await supabase.from(table).delete().eq('org_id', orgId)
    if (error) {
      console.error(`Error clearing ${table}:`, error)
      return
    }
  }

  // 4. Suppliers
  const { data: supplierRows, error: supplierError } = await supabase
    .from('suppliers')
    .insert(SUPPLIER_NAMES.map(name => ({ name, org_id: orgId })))
    .select('id, name')
  if (supplierError) {
    console.error('Error seeding suppliers:', supplierError)
    return
  }
  const supplierMap = new Map(supplierRows.map(s => [s.name, s.id]))

  // 5. Ingredients
  const ingredientRows = Object.entries(INGREDIENTS).map(([name, def]) => ({
    name,
    canonical_unit: def.canonical_unit,
    category: def.category,
    org_id: orgId,
  }))
  const { data: ingredientResult, error: ingredientError } = await supabase
    .from('ingredients')
    .insert(ingredientRows)
    .select('id, name')
  if (ingredientError) {
    console.error('Error seeding ingredients:', ingredientError)
    return
  }
  const ingredientMap = new Map(ingredientResult.map(i => [i.name, i.id]))

  // 6. Recipes + components
  const recipeIds: string[] = []
  for (const [name, recipe] of Object.entries(RECIPES)) {
    const { data: recipeRow, error: recipeInsertError } = await supabase
      .from('recipes')
      .insert({ menu_item_name: name, sale_price: recipe.sale_price, org_id: orgId })
      .select('id')
      .single()
    if (recipeInsertError) {
      console.error(`Error seeding recipe ${name}:`, recipeInsertError)
      return
    }
    recipeIds.push(recipeRow.id)

    const components = recipe.components.map(([ingredientName, qty, unit, yieldFactor]) => ({
      recipe_id: recipeRow.id,
      ingredient_id: ingredientMap.get(ingredientName),
      qty,
      unit,
      yield_factor: yieldFactor,
      org_id: orgId,
    }))
    const { error: componentError } = await supabase.from('recipe_components').insert(components)
    if (componentError) {
      console.error(`Error seeding components for ${name}:`, componentError)
      return
    }
  }

  // 7. Price history: weekly observations for 6 weeks; bumped prices on the last 2
  const now = new Date()
  const priceHistory: any[] = []
  for (const [name, def] of Object.entries(INGREDIENTS)) {
    const supplierId = supplierMap.get(def.supplier)
    const ingredientId = ingredientMap.get(name)
    for (let week = 5; week >= 0; week--) {
      const observed = new Date(now)
      observed.setDate(now.getDate() - week * 7)
      const isBumped = def.bumped !== undefined && week < 2
      priceHistory.push({
        org_id: orgId,
        ingredient_id: ingredientId,
        supplier_id: supplierId,
        unit_cost: isBumped ? def.bumped! : def.price,
        observed_at: observed.toISOString(),
      })
    }
  }
  const { error: priceHistoryError } = await supabase.from('price_history').insert(priceHistory)
  if (priceHistoryError) {
    console.error('Error seeding price history:', priceHistoryError)
    return
  }

  // 8. Par levels (drives alert impact via avg_daily_usage)
  const parRows = Object.entries(PAR_LEVELS).map(([name, pl]) => ({
    org_id: orgId,
    ingredient_id: ingredientMap.get(name),
    par_qty: pl.par_qty,
    reorder_lead_days: pl.reorder_lead_days,
    avg_daily_usage: pl.avg_daily_usage,
    stock: pl.stock,
  }))
  const { error: parError } = await supabase.from('par_levels').insert(parRows)
  if (parError) {
    console.error('Error seeding par levels:', parError)
    return
  }

  console.log(`Reference data seeded successfully:
  - suppliers: ${supplierRows.length}
  - ingredients: ${ingredientResult.length}
  - recipes: ${recipeIds.length}
  - price_history rows: ${priceHistory.length}
  - par_levels: ${parRows.length}`)
}

seedReference().catch(console.error)