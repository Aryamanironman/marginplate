export interface RecipeComponent {
    ingredient_id: string;
    qty: number; // in raw unit as per recipe
    unit: string; // unit of qty (e.g., 'g', 'kg', 'each', 'lb')
    yield_factor: number; // usable = qty * yield_factor
}

export interface IngredientCost {
    ingredient_id: string;
    unit_cost: number; // cost per canonical unit
}

export interface CostPerPlateResult {
    cost: number;
    salePrice: number;
    grossMarginPct: number;
    // We might want to return a flag for low margin, but the spec says to flag in the dashboard.
    // We'll just return the values and let the caller decide.
}

export function costPerPlate(
    recipe: {
        salePrice: number;
        components: RecipeComponent[];
    },
    ingredientCosts: IngredientCost[],
): CostPerPlateResult {
    // Build a map for quick lookup of ingredient cost by ingredient_id
    const costMap = new Map<string, number>();
    for (const ic of ingredientCosts) {
        costMap.set(ic.ingredient_id, ic.unit_cost);
    }

    let totalCost = 0;
    for (const comp of recipe.components) {
        const unitCost = costMap.get(comp.ingredient_id);
        if (unitCost === undefined) {
            throw new Error(`Missing cost for ingredient ${comp.ingredient_id}`);
        }
        const usableQty = comp.qty * comp.yield_factor;
        totalCost += usableQty * unitCost;
    }

    const salePrice = recipe.salePrice;
    const grossMarginPct = salePrice > 0 ? ((salePrice - totalCost) / salePrice) * 100 : 0;

    return {
        cost: totalCost,
        salePrice,
        grossMarginPct,
    };
}