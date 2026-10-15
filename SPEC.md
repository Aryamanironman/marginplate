# MarginPlate

A food-cost watchdog for independent restaurants. The owner photographs a supplier
invoice; we extract line items, normalize units, recompute cost-per-plate across the
menu, detect supplier price creep, and forecast stockouts.

## Stack (locked — do not substitute)
Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Supabase (Postgres +
Auth + Storage), Vercel. Vitest for tests. Zod for all input validation.

## Non-negotiable rules
1. Never hardcode a demo metric. Every number on screen comes from a DB query.
2. Every table: `org_id` column, RLS enabled, policy scoped to org, and a
   `set_org_id()` BEFORE INSERT trigger. No exceptions.
3. All four algorithms live in `lib/` as PURE functions with Vitest tests:
   units.ts, costing.ts, creep.ts, forecast.ts. No DB access inside them.
4. `strict: true`, no `any`, no non-null assertions without a comment.
5. Run `npm run typecheck && npm run test` before saying a phase is done.
6. Do not add features outside this spec. Do not refactor earlier phases.
7. Commit at the end of every phase with the message given in the prompt.

## Data model
unit_map(from_unit, to_unit, factor)
suppliers(id, org_id, name, phone, email)
ingredients(id, org_id, name, canonical_unit, category)
invoices(id, org_id, supplier_id, image_path, invoice_date, total,
         parse_status, ocr_confidence)
line_items(id, invoice_id, ingredient_id, raw_description, raw_qty, raw_unit,
           canonical_qty, canonical_unit, unit_price, line_total, confidence)
price_history(id, org_id, ingredient_id, supplier_id, unit_cost, observed_at)
recipes(id, org_id, menu_item_name, sale_price)
recipe_components(id, recipe_id, ingredient_id, qty, unit, yield_factor)
par_levels(id, org_id, ingredient_id, par_qty, reorder_lead_days, avg_daily_usage, stock)
alerts(id, org_id, type, ingredient_id, dollars_impact, payload, created_at, resolved_at)
jobs(id, type, payload, status, attempts, run_after, created_at)

## The four algorithms — exact behaviour

**units.ts** — `normalize(qty, fromUnit, toUnit, unitMap)` returns canonical qty.
Must handle case, lb, oz, each, kg, g. Case size is parsed from the description
("1 case (24 ct)" -> 24 each). Throw a typed error on an unmappable unit.

**costing.ts** — `costPerPlate(recipe, ingredientCosts)` walks recipe_components,
applies yield_factor (usable = qty * yield), multiplies by canonical unit cost,
sums. Returns { cost, salePrice, grossMarginPct }. Flag anything under 60%.

**creep.ts** — `detectCreep(history)` takes a per-ingredient, per-supplier time
series of unit_cost and returns { deltaPct, deltaPerUnit, annualImpact,
firstObservedAt }. annualImpact = deltaPerUnit * avgWeeklyUsage * 52. Round the
displayed dollar figure to the nearest $10. Only fire when deltaPct >= 8 and the
series spans >= 4 weeks.

**forecast.ts** — `daysUntilStockout(stock, avgDailyUsage, leadDays)` returns
{ daysLeft, runsOutOn, reorderOn, status }. runsOutOn = today + daysLeft.
reorderOn = runsOutOn - leadDays. status: ok | watch | reorder_now.

## Screens
1. `/dashboard` — big food-cost % figure, menu list sorted by margin, red flags,
   active alerts panel.
2. `/invoices` — list with thumbnails and parse status.
3. `/invoices/[id]` — photo left, parsed line items right, per-line confidence,
   inline correction.
4. `/alerts` — feed with dollar impact and the arithmetic shown.
5. `/recipes` — menu items with BOM and live margin.
6. `/suppliers`

## Auth
Supabase email auth. Email confirmation OFF. One seeded demo account.

## Visual
Dark UI, amber accent, dense and professional — an ops tool, not a landing page.
No gradients, no drop shadows, no marketing hero.