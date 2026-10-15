'use client';

import { supabase } from '@/lib/supabaseClient';
import { detectCreep } from '@/lib/creep';
import { ensureSession } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Array<any>>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<Array<any>>([]);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
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

      // Fetch price_history for this org with ingredient and supplier details
      const { data: priceHistoryData, error: priceHistoryError } = await supabase
        .from('price_history')
        .select(`
          id,
          ingredient_id,
          supplier_id,
          unit_cost,
          observed_at,
          ingredients!inner (name, canonical_unit),
          suppliers!inner (name)
        `)
        .eq('org_id', orgId)
        .order('observed_at', { ascending: true });

      if (priceHistoryError) throw priceHistoryError;

      // Fetch average daily usage from par_levels for real usage data
      const { data: parLevels, error: parLevelsError } = await supabase
        .from('par_levels')
        .select('ingredient_id, avg_daily_usage')
        .eq('org_id', orgId);

      if (parLevelsError) throw parLevelsError;

      const usageMap = new Map<string, number>();
      for (const pl of parLevels) {
        usageMap.set(pl.ingredient_id, pl.avg_daily_usage || 0);
      }

      // Group by (ingredient_id, supplier_id)
      const grouped: Record<string, any[]> = {};
      for (const entry of priceHistoryData) {
        const key = `${entry.ingredient_id}-${entry.supplier_id}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        // to-one embeds may come back as an object (PostgREST) or a one-element array (types)
        const ingredient = Array.isArray(entry.ingredients) ? entry.ingredients[0] : entry.ingredients;
        const supplier = Array.isArray(entry.suppliers) ? entry.suppliers[0] : entry.suppliers;
        grouped[key].push({
          ingredient_id: entry.ingredient_id,
          supplier_id: entry.supplier_id,
          unit_cost: entry.unit_cost,
          observed_at: entry.observed_at,
          avgWeeklyUsage: (usageMap.get(entry.ingredient_id) || 0) * 7,
          ingredient,
          supplier
        });
      }

      // Compute creep for each group
      const computedAlerts: Array<any> = [];
      for (const [key, history] of Object.entries(grouped)) {
        if (history.length >= 2) {
          const creepResult = detectCreep(history);
          if (creepResult) {
            const [firstEntry] = history;
            const ingredientName = firstEntry.ingredient.name;
            const supplierName = firstEntry.supplier.name;
            const firstObservedAt = new Date(creepResult.firstObservedAt);
            const weeksElapsed = Math.floor((new Date().getTime() - firstObservedAt.getTime()) / (1000 * 60 * 60 * 24 * 7));
            
            // Format the arithmetic string
            const arithmetic = `$${creepResult.deltaPerUnit.toFixed(2)}/${firstEntry.ingredient.canonical_unit} x ${(firstEntry.avgWeeklyUsage || 0).toFixed(0)} ${firstEntry.ingredient.canonical_unit}/wk x 52 = $${Math.round(creepResult.annualImpact / 10) * 10}/yr`;
            
            computedAlerts.push({
              id: crypto.randomUUID(), // Temporary ID for UI
              ingredient_id: firstEntry.ingredient_id,
              supplier_id: firstEntry.supplier_id,
              ingredient_name: ingredientName,
              supplier_name: supplierName,
              first_observed_at: creepResult.firstObservedAt,
              weeks_elapsed: weeksElapsed,
              delta_per_unit: creepResult.deltaPerUnit,
              delta_pct: creepResult.deltaPct,
              annual_impact: creepResult.annualImpact,
              canonical_unit: firstEntry.ingredient.canonical_unit,
              arithmetic,
              dollars_impact: Math.round(creepResult.annualImpact / 10) * 10 // Rounded to nearest $10
            });
          }
        }
      }

      // Sort by dollars_impact descending
      computedAlerts.sort((a, b) => b.dollars_impact - a.dollars_impact);
      
      // For now, we'll treat all as active (not resolved)
      // In a full implementation, we'd check the alerts table for resolved_at
      setAlerts(computedAlerts);
      setResolvedAlerts([]); // Placeholder
    } catch (err: any) {
      if (ensureSession(err)) return;
      console.error(err);
      setError(err.message ?? 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }

  async function resolveAlert(alertId: string) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) {
      return;
    }
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    setResolvedAlerts(prev => [...prev, alert]);
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Price Creep Alerts</h1>
      <p className="mb-4 text-gray-600">
        Alerts are computed live from price history using the detectCreep algorithm.
        An alert triggers when price change &gt;= 8% over &gt;= 4 weeks.
      </p>
      
      {/* Active Alerts */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Active Alerts ({alerts.length})</h2>
        {alerts.length === 0 ? (
          <p className="text-gray-500">No active price creep alerts.</p>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-red-50 border border-red-200 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">
                      {alert.ingredient_name} from {alert.supplier_name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-700">
                      First observed: {new Date(alert.first_observed_at).toLocaleDateString()} 
                      ({alert.weeks_elapsed} weeks ago)
                    </p>
                  </div>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
                <p className="mt-2 text-sm font-medium">
                  Impact: <span className="text-red-600">${alert.dollars_impact.toFixed(0)}/yr</span>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  {alert.arithmetic}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Delta: ${alert.delta_per_unit.toFixed(2)}/{alert.canonical_unit} 
                  ({alert.delta_pct.toFixed(1)}%)
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Alerts (collapsible) */}
      <div className="mb-8">
        <button
          onClick={() => setShowResolved(v => !v)}
          className="w-full text-left bg-gray-50 px-4 py-2 border border-gray-200 rounded"
        >
          Resolved Alerts ({resolvedAlerts.length}) {showResolved ? '▲' : '▼'}
        </button>
        {showResolved && (
          <div className="mt-4 space-y-4">
            {resolvedAlerts.length === 0 ? (
              <p className="text-sm text-gray-500">No resolved alerts.</p>
            ) : (
              resolvedAlerts.map((alert) => (
                <div key={alert.id} className="p-4 bg-gray-50 border border-gray-200 rounded">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {alert.ingredient_name} from {alert.supplier_name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Impact: <span className="font-medium">${alert.dollars_impact.toFixed(0)}/yr</span> — {alert.arithmetic}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}