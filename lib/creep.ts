export interface PriceHistoryEntry {
    unit_cost: number; // cost per canonical unit
    observed_at: string; // ISO timestamp
    avgWeeklyUsage: number; // in canonical units per week
}

export interface CreepResult {
    deltaPct: number; // percentage change from first to last
    deltaPerUnit: number; // absolute change in unit cost
    annualImpact: number; // dollars per year impact
    firstObservedAt: string; // ISO timestamp of the first observation
}

export function detectCreep(
    history: PriceHistoryEntry[]
): CreepResult | null {
    if (history.length < 2) {
        return null; // need at least two points to detect change
    }

    // Sort by observed_at ascending
    const sorted = [...history].sort(
        (a, b) => new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Calculate the time span in weeks between first and last observation
    const firstDate = new Date(first.observed_at);
    const lastDate = new Date(last.observed_at);
    const timeSpanMs = lastDate.getTime() - firstDate.getTime();
    const timeSpanWeeks = timeSpanMs / (1000 * 60 * 60 * 24 * 7); // milliseconds to weeks

    // Only fire when the series spans >= 4 weeks
    if (timeSpanWeeks < 4) {
        return null;
    }

    // Calculate percentage change
    const deltaPerUnit = last.unit_cost - first.unit_cost;
    const deltaPct = (first.unit_cost !== 0) ? (deltaPerUnit / first.unit_cost) * 100 : 0;

    // Only fire when deltaPct >= 8
    if (deltaPct < 8) {
        return null;
    }

    // We need avgWeeklyUsage from the history entries. The spec says:
    // annualImpact = deltaPerUnit * avgWeeklyUsage * 52
    // We'll use the average of avgWeeklyUsage across the history entries.
    // If not provided, we cannot compute. We'll assume it's provided in each entry.
    const avgWeeklyUsage =
        sorted.reduce((sum, entry) => sum + entry.avgWeeklyUsage, 0) /
        sorted.length;

    const annualImpact = deltaPerUnit * avgWeeklyUsage * 52;

    // Round the displayed dollar figure to the nearest $10 (as per spec)
    // We'll do the rounding in the UI, but we can also return the rounded value.
    // We'll return the exact annualImpact and let the UI round it.
    // But the spec says: "Round the displayed dollar figure to the nearest $10."
    // We'll store the exact value and round in the component.

    return {
        deltaPct,
        deltaPerUnit,
        annualImpact,
        firstObservedAt: first.observed_at,
    };
}