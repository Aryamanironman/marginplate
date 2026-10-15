import { supabase } from '@/lib/supabaseClient';
import { costPerPlate } from '@/lib/costing';
import { normalize } from '@/lib/units';

/**
 * Fetch the latest unit cost for each ingredient in the organization.
 * Returns a map of ingredient_id to unit_cost (per canonical unit).
 */
export async function fetchLatestIngredientCosts(orgId: string) {
  const { data: priceHistory, error } = await supabase
    .from('price_history')
    .select('ingredient_id, unit_cost, observed_at')
    .eq('org_id', orgId)
    .order('observed_at', { ascending: false });

  if (error) throw error;

  // Group by ingredient_id and take the first (most recent) entry for each
  const latestCosts = new Map<string, number>();
  for (const ph of priceHistory) {
    if (!latestCosts.has(ph.ingredient_id)) {
      latestCosts.set(ph.ingredient_id, ph.unit_cost);
    }
  }
  return latestCosts;
}

/**
 * Fetch the unit_map table and return it as an array of conversion objects.
 */
export async function fetchUnitMap() {
  const { data: unitMap, error } = await supabase.from('unit_map').select('*');
  if (error) throw error;
  return unitMap;
}

/**
 * Fetch all recipes for an organization along with their components.
 */
export async function fetchRecipesWithComponents(orgId: string) {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      id,
      menu_item_name,
      sale_price,
      recipe_components!inner (
        id,
        qty,
        unit,
        yield_factor,
        ingredients!inner (id, name, canonical_unit)
      )
    `)
    .eq('org_id', orgId);

  if (error) throw error;

  // Group by recipe
  const recipesMap = new Map<string, any>();
  for (const r of recipes) {
    if (!recipesMap.has(r.id)) {
      recipesMap.set(r.id, {
        id: r.id,
        menu_item_name: r.menu_item_name,
        sale_price: r.sale_price,
        components: [],
      });
    }
    const recipe = recipesMap.get(r.id);
    // r.recipe_components is an array of component objects
    for (const comp of r.recipe_components) {
      // to-one embeds may come back as an object (PostgREST) or a one-element array (types)
      const ingredient = Array.isArray(comp.ingredients) ? comp.ingredients[0] : comp.ingredients;
      recipe.components.push({
        qty: comp.qty,
        unit: comp.unit,
        yield_factor: comp.yield_factor,
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        canonical_unit: ingredient.canonical_unit,
      });
    }
  }

  return Array.from(recipesMap.values());
}

/**
 * Compute the cost per plate for a recipe given the latest ingredient costs and unit map.
 */
export async function computeRecipeCost(
  recipe: any,
  ingredientCosts: Map<string, number>,
  unitMap: any[]
) {
  // Build the ingredientCosts array expected by costPerPlate
  const ingredientCostsArray: { ingredient_id: string; unit_cost: number }[] = [];
  for (const comp of recipe.components) {
    const unitCost = ingredientCosts.get(comp.ingredient_id);
    if (unitCost === undefined) {
      throw new Error(`Missing cost for ingredient ${comp.ingredient_id}`);
    }
    ingredientCostsArray.push({
      ingredient_id: comp.ingredient_id,
      unit_cost: unitCost,
    });
  }

  // Build the recipe object expected by costPerPlate; qty converted to canonical units first
  const recipeObj = {
    salePrice: recipe.salePrice,
    components: recipe.components.map((comp: any) => ({
      ingredient_id: comp.ingredient_id,
      qty: normalize(comp.qty, comp.unit, comp.canonical_unit, unitMap),
      unit: comp.canonical_unit,
      yield_factor: comp.yield_factor,
    })),
  };

  return costPerPlate(recipeObj, ingredientCostsArray);
}

/**
 * Compute the overall food-cost percentage for the organization.
 * We define it as the average of (cost/salePrice) across all recipes.
 * Alternatively, we could compute a weighted average by some usage metric,
 * but we don't have sales data. We'll use the simple average.
 */
export async function computeFoodCostPercentage(orgId: string) {
  try {
    const [unitMap, ingredientCosts, recipes] = await Promise.all([
      fetchUnitMap(),
      fetchLatestIngredientCosts(orgId),
      fetchRecipesWithComponents(orgId),
    ]);

    if (recipes.length === 0) {
      return null;
    }

    let totalFoodCostPct = 0;
    let count = 0;

    for (const recipe of recipes) {
      try {
        const result = await computeRecipeCost(recipe, ingredientCosts, unitMap);
        const foodCostPct = (result.cost / recipe.salePrice) * 100;
        totalFoodCostPct += foodCostPct;
        count++;
      } catch (err) {
        // A recipe with missing cost or unmappable unit is skipped, not averaged in
        console.error(`Skipping recipe "${recipe.menu_item_name}":`, err);
      }
    }

    if (count === 0) {
      return null;
    }
    return totalFoodCostPct / count;
  } catch (err) {
    console.error('Error computing food-cost percentage:', err);
    return null;
  }
}