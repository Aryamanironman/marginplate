export interface StockoutResult {
    daysLeft: number;
    runsOutOn: string; // ISO timestamp
    reorderOn: string; // ISO timestamp
    status: 'ok' | 'watch' | 'reorder_now';
}

export function daysUntilStockout(
    stock: number,
    avgDailyUsage: number,
    leadDays: number
): StockoutResult {
    if (avgDailyUsage <= 0) {
        throw new Error('Average daily usage must be greater than zero');
    }
    const daysLeft = stock / avgDailyUsage;
    const now = Date.now();
    const runsOutOn = new Date(now + daysLeft * 24 * 60 * 60 * 1000);
    const reorderOn = new Date(runsOutOn.getTime() - leadDays * 24 * 60 * 60 * 1000);

    let status: 'ok' | 'watch' | 'reorder_now' = 'ok';
    if (daysLeft <= leadDays) {
        status = 'reorder_now';
    } else if (daysLeft <= leadDays * 2) {
        status = 'watch';
    }

    return {
        daysLeft,
        runsOutOn: runsOutOn.toISOString(),
        reorderOn: reorderOn.toISOString(),
        status,
    };
}