'use client';

import { supabase } from '@/lib/supabaseClient';
import { ensureSession } from '@/lib/auth';
import { useEffect, useState } from 'react';

export default function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  async function fetchInvoice() {
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

      // Fetch the invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_date,
          total,
          parse_status,
          ocr_confidence,
          error,
          suppliers!inner (name),
          image_path
        `)
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      // Fetch the line items for this invoice
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('line_items')
        .select(`
          id,
          raw_description,
          raw_qty,
          raw_unit,
          canonical_qty,
          canonical_unit,
          unit_price,
          line_total,
          confidence,
          match_confidence,
          ingredients!inner (name, canonical_unit)
        `)
        .eq('invoice_id', id)
        .order('created_at', { ascending: true });

      if (lineItemsError) throw lineItemsError;
      setLineItems(lineItemsData);
    } catch (err: any) {
      if (ensureSession(err)) return;
      console.error(err);
      setError(err.message ?? 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!invoice) return <div className="p-6">Invoice not found</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-1/2">
          <h1 className="text-2xl font-bold mb-4">Invoice #{invoice.id}</h1>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Date: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
            <p className="text-sm text-gray-500">Supplier: {invoice.suppliers?.name || 'Unknown'}</p>
            <p className="text-sm text-gray-500">Status: 
              <span className={`${invoice.parse_status === 'parsed' ? 'text-green-600' : invoice.parse_status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                {invoice.parse_status}
              </span>
            </p>
            {invoice.ocr_confidence !== null && (
              <p className="text-sm text-gray-500">OCR Confidence: {(invoice.ocr_confidence * 100).toFixed(1)}%</p>
            )}
            {invoice.error && (
              <p className="text-sm text-red-500 mt-2">Error: {invoice.error}</p>
            )}
          </div>
          {invoice.image_path && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Invoice Image</h2>
              <img src={invoice.image_path} alt="Invoice" className="max-w-full h-auto rounded border" />
            </div>
          )}
        </div>
        <div className="w-full md:w-1/2">
          <h2 className="text-lg font-semibold mb-4">Line Items</h2>
          {lineItems.length === 0 ? (
            <p className="text-gray-500">No line items found.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Line Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Match Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.raw_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.raw_qty}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.raw_unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${item.unit_price?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${item.line_total?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.match_confidence !== null ? (
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.match_confidence >= 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {(item.match_confidence * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-red-500">Unmatched</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}