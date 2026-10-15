'use client';

import { supabase } from '@/lib/supabaseClient';
import { costPerPlate } from '@/lib/costing';
import { normalize } from '@/lib/units';
import { ensureSession } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function RecipesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Array<any>>([]);

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('No user found');
        return;
      }

      // Get the user's org_id from their profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      const orgId = profileData.org_id;

      // Fetch recipes with their components and ingredient details
      const { data: recipesData, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          id,
          menu_item_name,
          sale_price,
          recipe_components!inner (
            qty,
            unit,
            yield_factor,
            ingredients!inner (id, name, canonical_unit)
          )
        `)
        .eq('org_id', orgId)
        .order('menu_item_name');

      if (recipesError) throw recipesError;

      // Fetch latest ingredient costs for cost calculation
      const { data: priceHistoryData, error: priceHistoryError } = await supabase
        .from('price_history')
        .select('ingredient_id, unit_cost, observed_at')
        .eq('org_id', orgId)
        .order('observed_at', { ascending: false });

      if (priceHistoryError) throw priceHistoryError;

      // Fetch unit conversions
      const { data: unitMapData, error: unitMapError } = await supabase.from('unit_map').select('*');
      if (unitMapError) throw unitMapError;

      // to-one embeds may come back as an object (PostgREST) or a one-element array (types)
      const ing1 = (comp: any) => (Array.isArray(comp.ingredients) ? comp.ingredients[0] : comp.ingredients);

      // Convert a component qty to its ingredient's canonical unit (falls back to raw qty)
      const toCanonical = (comp: any) => {
        try {
          return normalize(comp.qty, comp.unit, ing1(comp).canonical_unit, unitMapData);
        } catch {
          return comp.qty;
        }
      };

      // Build latest cost map (most recent cost per ingredient)
      const latestCosts = new Map<string, number>();
      for (const ph of priceHistoryData) {
        if (!latestCosts.has(ph.ingredient_id)) {
          latestCosts.set(ph.ingredient_id, ph.unit_cost);
        }
      }

      // Compute cost per plate for each recipe
      const recipesWithCost: Array<any> = [];
      for (const r of recipesData) {
        // Build ingredientCosts array for costPerPlate function
        const ingredientCosts: Array<{ ingredient_id: string; unit_cost: number }> = [];
        for (const comp of r.recipe_components) {
          const unitCost = latestCosts.get(ing1(comp).id);
          if (unitCost === undefined) {
            // If missing cost, we'll skip this ingredient in cost calculation
            // In a real app, we might want to handle this differently
            continue;
          }
          ingredientCosts.push({
            ingredient_id: ing1(comp).id,
            unit_cost: unitCost
          });
        }

        // Only calculate cost if we have costs for all ingredients
        if (ingredientCosts.length === r.recipe_components.length) {
          const recipeObj = {
            salePrice: r.sale_price,
            components: r.recipe_components.map(comp => ({
              ingredient_id: ing1(comp).id,
              qty: toCanonical(comp),
              unit: ing1(comp).canonical_unit,
              yield_factor: comp.yield_factor
            }))
          };

          const costResult = costPerPlate(recipeObj, ingredientCosts);
          
          recipesWithCost.push({
            id: r.id,
            menu_item_name: r.menu_item_name,
            sale_price: r.sale_price,
            cost: costResult.cost,
            grossMarginPct: costResult.grossMarginPct,
            components: r.recipe_components.map(comp => ({
              ingredient_name: ing1(comp).name,
              qty: comp.qty,
              unit: comp.unit,
              yield_factor: comp.yield_factor,
              usable_qty: toCanonical(comp) * comp.yield_factor,
              canonical_unit: ing1(comp).canonical_unit,
              unit_cost: latestCosts.get(ing1(comp).id) || 0,
              line_cost: toCanonical(comp) * comp.yield_factor * (latestCosts.get(ing1(comp).id) || 0)
            }))
          });
        } else {
          // If we're missing cost data for any ingredient, still show the recipe but with null cost
          recipesWithCost.push({
            id: r.id,
            menu_item_name: r.menu_item_name,
            sale_price: r.sale_price,
            cost: null,
            grossMarginPct: null,
            components: r.recipe_components.map(comp => ({
              ingredient_name: ing1(comp).name,
              qty: comp.qty,
              unit: comp.unit,
              yield_factor: comp.yield_factor,
              usable_qty: toCanonical(comp) * comp.yield_factor,
              canonical_unit: ing1(comp).canonical_unit,
              unit_cost: latestCosts.get(ing1(comp).id) || null,
              line_cost: toCanonical(comp) * comp.yield_factor * (latestCosts.get(ing1(comp).id) || 0)
            }))
          });
        }
      }

      // Sort by grossMarginPct ascending (worst margin first)
      recipesWithCost.sort((a, b) => {
        // Handle null values - put them at the end
        if (a.grossMarginPct === null && b.grossMarginPct === null) return 0;
        if (a.grossMarginPct === null) return 1;
        if (b.grossMarginPct === null) return -1;
        return a.grossMarginPct - b.grossMarginPct;
      });
      
      setRecipes(recipesWithCost);
    } catch (err: any) {
      if (ensureSession(err)) return;
      console.error(err);
      setError(err.message ?? 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Menu Items & Margins</h1>
      <p className="mb-4 text-gray-600">
        Recipes sorted by gross margin (lowest first). Items under 60% margin are flagged.
      </p>
      
      {recipes.length === 0 ? (
        <p className="text-gray-500">No recipes found.</p>
      ) : (
        <div className="space-y-4">
          {recipes.map((recipe) => (
            <div key={recipe.id} className={`border rounded-lg p-4 ${recipe.grossMarginPct !== null && recipe.grossMarginPct < 60 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {recipe.menu_item_name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Sale Price: ${recipe.sale_price.toFixed(2)}
                  </p>
                </div>
                {recipe.grossMarginPct !== null ? (
                  <div className="text-right space-x-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${recipe.grossMarginPct >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {recipe.grossMarginPct.toFixed(1)}% Margin
                    </span>
                    {recipe.cost !== null && (
                      <span className="text-xs text-gray-500 ml-2">
                        Cost: ${recipe.cost.toFixed(2)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                      Cost data incomplete
                    </span>
                  </div>
                )}
              </div>
              
              {recipe.cost !== null && (
                <div className="mb-3">
                  <h3 className="text-lg font-semibold mb-2">Bill of Materials</h3>
                  <div className="space-y-2">
                    {recipe.components.map((comp: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm bg-white p-3 rounded border">
                        <div>
                          <div className="font-medium">{comp.ingredient_name}</div>
                          <div className="text-xs text-gray-500">
                            {comp.qty} {comp.unit} × yield {comp.yield_factor} = {comp.usable_qty.toFixed(2)} {comp.canonical_unit}
                          </div>
                        </div>
                        <div className="text-right space-x-2">
                          <div className="font-medium">${comp.line_cost.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">
                            @ ${comp.unit_cost !== null ? comp.unit_cost.toFixed(2) : '?'} / {comp.canonical_unit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total Cost:</span>
                      <span>${recipe.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {!recipe.cost && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    Unable to calculate cost - missing price data for one or more ingredients.
                    Please ensure price history has been seeded for all ingredients.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}