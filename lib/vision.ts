import { z } from 'zod'

export interface RawInvoice {
  supplier_name: string
  invoice_date: string // ISO date string (YYYY-MM-DD)
  total: number
  lines: Array<{
    description: string
    qty: number
    unit: string
    unit_price: number
    line_total: number
    confidence: number
  }>
}

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
})

export class VisionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VisionError'
  }
}

export async function extractInvoice(
  imageUrl: string
): Promise<RawInvoice> {
  // In a real implementation, this would call an external vision API
  // For now, we'll throw an error to remind implementers to plug in the real service
  throw new VisionError(
    'Vision service not implemented. Set VISION_MODEL and VISION_API_KEY and implement the call to your vision provider.'
  )
}