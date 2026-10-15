import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractInvoice } from '@/lib/vision';
import { normalize } from '@/lib/units';
import { z } from 'zod';

const rawInvoiceSchema = z.object({
  supplier_name: z.string(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().positive(),
  lines: z.array(
    z.object({
      description: z.string(),
      qty: z.number().positive(),
      unit: z.string(),
      unit_price: z.number().positive(),
      line_total: z.number().positive(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export async function POST(request: NextRequest) {
  let invoiceId: string | undefined = undefined;
  try {
    const { invoiceId: id } = await request.json();
    invoiceId = id;

    // 1. Load the invoice and its stored image
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('id, org_id, supplier_id, image_path')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // 2. Call extractInvoice
    const rawInvoice = await extractInvoice(invoice.image_path);

    // 3. Validate the response with Zod
    const parsed = rawInvoiceSchema.parse(rawInvoice);

    // 4. Match each line's description to an ingredient
    // First, get all ingredients and aliases for this org and supplier
    const { data: ingredients, error: ingredientsError } = await supabaseAdmin
      .from('ingredients')
      .select('id, name, canonical_unit')
      .eq('org_id', invoice.org_id);

    if (ingredientsError) throw ingredientsError;

    const { data: aliases, error: aliasesError } = await supabaseAdmin
      .from('ingredient_aliases')
      .select('ingredient_id, raw_description')
      .eq('org_id', invoice.org_id)
      .eq('supplier_id', invoice.supplier_id);

    if (aliasesError) throw aliasesError;

    // Build a map for exact alias matches: (supplier_id, raw_description) -> ingredient_id
    const aliasMap = new Map<string, string>();
    for (const alias of aliases) {
      aliasMap.set(alias.raw_description, alias.ingredient_id);
    }

    // Build a map for ingredient name lookup (case-insensitive)
    const ingredientNameMap = new Map<string, string>();
    for (const ing of ingredients) {
      ingredientNameMap.set(ing.name.toLowerCase(), ing.id);
    }

    const lineItems = [];
    const priceHistoryEntries = [];

    for (const line of parsed.lines) {
      let ingredientId = null;
      let matchConfidence = 0;

      // Try exact alias match
      const aliasMatch = aliasMap.get(line.description);
      if (aliasMatch) {
        ingredientId = aliasMatch;
        matchConfidence = 1.0;
      } else {
        // Try fuzzy match against ingredient names (simple lowercase match)
        const ingredientMatch = ingredientNameMap.get(line.description.toLowerCase());
        if (ingredientMatch) {
          ingredientId = ingredientMatch;
          matchConfidence = 0.9; // high confidence for exact name match
        }
      }

      // Determine canonical quantity and unit
      let canonicalQty: number | null = null;
      let canonicalUnit: string | null = null;
      let unitPrice = line.unit_price;
      let lineTotal = line.line_total;

      if (ingredientId) {
        // Get the ingredient's canonical unit to see if conversion is needed
        const ingredient = ingredients.find(i => i.id === ingredientId);
        if (ingredient) {
          // We need to convert from line.unit to ingredient.canonical_unit using unit_map
          // For simplicity, we assume the unit_map table is available via a function or we can query it.
          // We'll query unit_map for the conversion factor.
          const { data: unitMapData, error: unitMapError } = await supabaseAdmin
            .from('unit_map')
            .select('factor')
            .eq('from_unit', line.unit.toLowerCase())
            .eq('to_unit', ingredient.canonical_unit.toLowerCase())
            .single();

          if (!unitMapError && unitMapData) {
            const factor = unitMapData.factor;
            canonicalQty = line.qty * factor;
            canonicalUnit = ingredient.canonical_unit;
            // unit_price and line_total are per canonical unit? We need to adjust.
            // If we converted quantity, the unit price per canonical unit is the same (price per unit).
            // Actually line.unit_price is per line.unit. So price per canonical unit = line.unit_price / factor.
            unitPrice = line.unit_price / factor;
            lineTotal = unitPrice * canonicalQty;
          } else {
            // If no conversion found, we leave canonicalQty and canonicalUnit as null.
            // The spec says to leave the canonical fields null rather than throwing.
          }
        }
      }

      lineItems.push({
        invoice_id: invoiceId,
        ingredient_id: ingredientId,
        raw_description: line.description,
        raw_qty: line.qty,
        raw_unit: line.unit,
        canonical_qty: canonicalQty,
        canonical_unit: canonicalUnit,
        unit_price: unitPrice,
        line_total: lineTotal,
        confidence: line.confidence,
        match_confidence: matchConfidence,
      });

      if (ingredientId) {
        priceHistoryEntries.push({
          org_id: invoice.org_id,
          ingredient_id: ingredientId,
          supplier_id: invoice.supplier_id,
          unit_cost: unitPrice, // unit cost per canonical unit
          observed_at: parsed.invoice_date, // use invoice date
        });
      }
    }

    // 5. Insert line_items
    if (lineItems.length > 0) {
      const { error: lineItemsError } = await supabaseAdmin
        .from('line_items')
        .insert(lineItems);

      if (lineItemsError) throw lineItemsError;
    }

    // 6. Insert price_history
    if (priceHistoryEntries.length > 0) {
      const { error: priceHistoryError } = await supabaseAdmin
        .from('price_history')
        .insert(priceHistoryEntries);

      if (priceHistoryError) throw priceHistoryError;
    }

    // 7. Update invoice status
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update({
        parse_status: 'parsed',
        ocr_confidence: parsed.lines.reduce((sum, line) => sum + line.confidence, 0) / parsed.lines.length,
      })
      .eq('id', invoiceId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    // If we have an invoiceId, mark as failed
    if (invoiceId !== undefined) {
      await supabaseAdmin
        .from('invoices')
        .update({ parse_status: 'failed', error: err.message })
        .eq('id', invoiceId);
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}