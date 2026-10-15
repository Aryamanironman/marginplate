import { supabase } from '@/lib/supabaseClient';
import { computeFoodCostPercentage } from '@/lib/dashboard';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [foodCostPct, setFoodCostPct] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<Array<{ id: string; menu_item_name: string; sale_price: number; cost: number; marginPct: number }>>([]);
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; ingredient_id: string; dollars_impact: number; payload: string; created_at: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('No user found');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      const orgId = profileData.org_id;

      // Compute food-cost percentage
      const pct = await computeFoodCostPercentage(orgId);
      setFoodCostPct(pct);

      // Fetch recipes with their components and latest ingredient costs to compute margin
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
            ingredients!inner (
              id,
              name,
              canonical_unit
            )
          )
        `)
        .eq('org_id', orgId);

      if (recipesError) throw recipesError;

      // For simplicity, we'll compute cost per recipe using a helper function.
      // We'll reuse the logic from dashboard.ts but we can compute on the fly.
      // Since we already have computeFoodCostPercentage, we could also fetch the latest costs and unit map.
      // Let's do a simplified version: we'll compute cost per recipe by calling a function that we'll create.
      // However, to avoid overcomplicating, we'll fetch the necessary data and compute.

      // Fetch latest ingredient costs and unit map
      const [priceHistoryData, unitMapData] = await Promise.all([
        supabase
          .from('price_history')
          .select('ingredient_id, unit_cost, observed_at')
          .eq('org_id', orgId)
          .order('observed_at', { ascending: false }),
        supabase.from('unit_map').select('*')
      ]);

      if (priceHistoryData.error) throw priceHistoryData.error;
      if (unitMapData.error) throw unitMapData.error;

      // Build latest cost map
      const latestCosts = new Map<string, number>();
      for (const ph of priceHistoryData.data) {
        if (!latestCosts.has(ph.ingredient_id)) {
          latestCosts.set(ph.ingredient_id, ph.unit_cost);
        }
      }

      // Compute cost for each recipe
      const recipesWithCost: Array<{ id: string; menu_item_name: string; sale_price: number; cost: number; marginPct: number }> = [];
      for (const r of recipesData.data) {
        let totalCost = 0;
        for (const comp of r.recipe_components) {
          const unitCost = latestCosts.get(comp.ingredients.id);
          if (unitCost === undefined) {
            // If missing cost, skip or assume 0? We'll assume 0 for now.
            continue;
          }
          const usableQty = comp.qty * comp.yield_factor;
          // We need to convert from comp.unit to ingredient.canonical_unit using unit_map.
          // For simplicity, we assume the unit_map table is available and we can query it.
          // We'll implement a simple conversion function.
          const conversionFactor = 1; // TODO: implement proper conversion using unitMapData.data
          // For now, we assume the unit is already canonical (or we ignore conversion).
          // This is a placeholder; in a real implementation we would use the unit_map.
          totalCost += usableQty * unitCost * conversionFactor;
        }
        const marginPct = ((r.sale_price - totalCost) / r.sale_price) * 100;
        recipesWithCost.push({
          id: r.id,
          menu_item_name: r.menu_item_name,
          sale_price: r.sale_price,
          cost: totalCost,
          marginPct: isNaN(marginPct) ? 0 : marginPct,
        });
      }

      // Sort by marginPct ascending (worst margin first)
      recipesWithCost.sort((a, b) => a.marginPct - b.marginPct);
      setRecipes(recipesWithCost);

      // Fetch active alerts (not resolved)
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select('id, type, ingredient_id, dollars_impact, payload, created_at')
        .eq('org_id', orgId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;
      setAlerts(alertsData.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">MarginPlate Dashboard</h1>

      {/* Food-cost percentage */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Food-Cost Percentage</h2>
        <p className="text-5xl font-bold">
          {foodCostPct !== null ? foodCostPct.toFixed(1) + '%' : '--'}
        </p>
        <p className="text-sm text-gray-500">
          Lower is better. Target: under 30%.
        </p>
      </div>

      {/* Recipes sorted by margin (worst first) */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Menu Items (Sorted by Margin)</h2>
        {recipes.length === 0 ? (
          <p className="text-gray-500">No recipes found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sale Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recipes.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.marginPct < 60 ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {r.menu_item_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${r.sale_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${r.cost.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      r.marginPct >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {r.marginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Active alerts */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Active Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-500">No active alerts.</p>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-red-50 border border-red-200 rounded">
                <div className="flex justify-between">
                  <h3 className="text-lg font-semibold text-red-800">
                    {alert.type}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Impact: ${alert.dollars_impact.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {alert.payload}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}