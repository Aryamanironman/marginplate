'use client';

import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

export default function SuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Array<any>>([]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setError('No user found');
        return;
      }

      // RLS will automatically restrict to the user's org when using the anon client
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, phone, email')
        .order('name');

      if (suppliersError) throw suppliersError;

      // Fetch invoices for spend and count calculations
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('supplier_id, total')
        .not('total', 'is', null); // exclude null totals if any

      if (invoicesError) throw invoicesError;

      // Group invoices by supplier_id
      const invoiceMap: Record<string, { count: number; total: number }> = {};
      for (const inv of invoicesData) {
        if (!invoiceMap[inv.supplier_id]) {
          invoiceMap[inv.supplier_id] = { count: 0, total: 0 };
        }
        invoiceMap[inv.supplier_id].count += 1;
        invoiceMap[inv.supplier_id].total += Number(inv.total);
      }

      // Combine supplier data with invoice stats
      const suppliersWithStats = suppliersData.map(sup => {
        const stats = invoiceMap[sup.id] || { count: 0, total: 0 };
        return {
          ...sup,
          invoice_count: stats.count,
          total_spend: stats.total
        };
      });

      setSuppliers(suppliersWithStats);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
      <p className="mb-4 text-gray-600">
        List of suppliers for your organization. Shows invoice count and total spend.
      </p>
      
      {suppliers.length === 0 ? (
        <p className="text-gray-500">No suppliers found.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice Count
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Spend
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suppliers.map((sup) => (
              <tr key={sup.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sup.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sup.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sup.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {sup.invoice_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${sup.total_spend.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}