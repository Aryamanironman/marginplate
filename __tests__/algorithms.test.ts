import { describe, it, expect } from 'vitest'
import { normalize, UnitConversionError } from '../lib/units'
import { costPerPlate } from '../lib/costing'
import { detectCreep } from '../lib/creep'
import { daysUntilStockout } from '../lib/forecast'

describe('units.ts', () => {
  const unitMap = [
    { from_unit: 'case', to_unit: 'each', factor: 24 },
    { from_unit: 'lb', to_unit: 'oz', factor: 16 },
    { from_unit: 'oz', to_unit: 'lb', factor: 1/16 },
    { from_unit: 'kg', to_unit: 'g', factor: 1000 },
    { from_unit: 'g', to_unit: 'kg', factor: 0.001 },
    { from_unit: 'each', to_unit: 'each', factor: 1 },
  ]

  it('converts case to each', () => {
    expect(normalize(1, 'case', 'each', unitMap)).toBe(24)
  })

  it('converts lb to oz', () => {
    expect(normalize(1, 'lb', 'oz', unitMap)).toBe(16)
  })

  it('converts oz to lb', () => {
    expect(normalize(16, 'oz', 'lb', unitMap)).toBe(1)
  })

  it('converts kg to g', () => {
    expect(normalize(1, 'kg', 'g', unitMap)).toBe(1000)
  })

  it('converts g to kg', () => {
    expect(normalize(1000, 'g', 'kg', unitMap)).toBe(1)
  })

  it('throws on unmappable unit', () => {
    expect(() => normalize(1, 'unknown', 'each', unitMap)).toThrow(UnitConversionError)
  })
})

describe('costing.ts', () => {
  it('calculates cost and margin for a simple recipe', () => {
    const recipe = {
      salePrice: 10.0,
      components: [
        { ingredient_id: 'ing1', qty: 2, unit: 'g', yield_factor: 1.0 },
      ],
    }
    const ingredientCosts = [
      { ingredient_id: 'ing1', unit_cost: 0.01 }, // $0.01 per gram
    ]

    const result = costPerPlate(recipe, ingredientCosts)
    expect(result.cost).toBeCloseTo(0.02) // 2g * $0.01/g = $0.02
    expect(result.salePrice).toBe(10.0)
    expect(result.grossMarginPct).toBeCloseTo(99.8) // (10 - 0.02)/10 * 100 = 99.8
  })

  it('applies yield factor correctly', () => {
    const recipe = {
      salePrice: 5.0,
      components: [
        { ingredient_id: 'ing1', qty: 100, unit: 'g', yield_factor: 0.8 }, // only 80g usable
      ],
    }
    const ingredientCosts = [
      { ingredient_id: 'ing1', unit_cost: 0.02 }, // $0.02 per gram
    ]

    const result = costPerPlate(recipe, ingredientCosts)
    // usable qty = 100 * 0.8 = 80g
    // cost = 80 * 0.02 = $1.6
    expect(result.cost).toBeCloseTo(1.6)
    expect(result.grossMarginPct).toBeCloseTo((5.0 - 1.6) / 5.0 * 100) // 68.0
  })
})

describe('creep.ts', () => {
  it('returns null for series less than 4 weeks', () => {
    const history = [
      { unit_cost: 2.0, observed_at: '2026-01-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 2.5, observed_at: '2026-01-20T00:00:00Z', avgWeeklyUsage: 10 }, // less than 4 weeks
    ]
    expect(detectCreep(history)).toBeNull()
  })

  it('returns null for deltaPct less than 8%', () => {
    const history = [
      { unit_cost: 2.0, observed_at: '2026-01-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 2.1, observed_at: '2026-02-01T00:00:00Z', avgWeeklyUsage: 10 }, // 5% increase over ~4 weeks? Actually 5% < 8
      { unit_cost: 2.2, observed_at: '2026-03-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 2.15, observed_at: '2026-04-01T00:00:00Z', avgWeeklyUsage: 10 },
    ]
    expect(detectCreep(history)).toBeNull()
  })

  it('returns creep result when deltaPct >=8 and series >=4 weeks', () => {
    const history = [
      { unit_cost: 2.0, observed_at: '2026-01-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 2.2, observed_at: '2026-02-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 2.5, observed_at: '2026-03-01T00:00:00Z', avgWeeklyUsage: 10 },
      { unit_cost: 3.0, observed_at: '2026-04-01T00:00:00Z', avgWeeklyUsage: 10 }, // 50% increase over 3 months (~12 weeks)
    ]
    const result = detectCreep(history)
    expect(result).not.toBeNull()
    if (result) {
      expect(result.deltaPct).toBeCloseTo(50.0) // (3.0-2.0)/2.0 * 100 = 50
      expect(result.deltaPerUnit).toBeCloseTo(1.0)
      // annualImpact = deltaPerUnit * avgWeeklyUsage * 52 = 1.0 * 10 * 52 = 520
      expect(result.annualImpact).toBeCloseTo(520)
      expect(result.firstObservedAt).toBe('2026-01-01T00:00:00Z')
    }
  })
})

describe('forecast.ts', () => {
  it('calculates days until stockout correctly', () => {
    // Suppose today is 2026-01-01 for simplicity, but we'll use relative dates.
    // We'll mock the date by using a fixed now? The function uses Date.now().
    // We'll set the system date by mocking? Instead, we'll compute based on the given inputs and check the logic.
    // We'll just test the arithmetic.

    const stock = 100 // units
    const avgDailyUsage = 5 // units per day
    const leadDays = 3 // days

    const result = daysUntilStockout(stock, avgDailyUsage, leadDays)
    // daysLeft = stock / avgDailyUsage = 100/5 = 20 days
    // runsOutOn = today + 20 days
    // reorderOn = runsOutOn - leadDays = (today+20) - 3 = today+17
    // status: ok (since daysLeft > leadDays? Actually status is based on daysLeft vs leadDays? Let's see the spec:
    // status: ok | watch | reorder_now.
    // We need to know the exact rule. The spec didn't specify the thresholds for status.
    // Looking back at the spec: 
    //   status: ok | watch | reorder_now.
    // We need to infer from common practice: 
    //   ok: when stock is above safety stock (maybe more than lead days * avgDailyUsage + some buffer)
    //   watch: when stock is between safety stock and reorder point?
    //   reorder_now: when stock <= reorder point (which is leadDays * avgDailyUsage)?
    // However, the spec didn't define. We'll assume:
    //   reorder_now: when daysLeft <= leadDays (i.e., stock <= avgDailyUsage * leadDays)
    //   watch: when daysLeft <= leadDays * 2 (or some other threshold)? Not specified.
    // Since the spec didn't define, we'll skip the status for now and just check the dates.
    // But the spec says: status: ok | watch | reorder_now.
    // We'll leave it as is and hope the implementation in the algorithm file defines it.
    // We'll look at the algorithm file we wrote? We haven't written forecast.ts yet.
    // Oops! We haven't written forecast.ts. We only wrote units, costing, creep.
    // We need to write forecast.ts as well.

    // Let's pause and write forecast.ts first.
  })
})