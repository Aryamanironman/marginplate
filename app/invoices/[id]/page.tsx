import InvoiceDetail from './InvoiceDetail';

// Dynamic route (invoice ids come from the user's data) — render on demand
export const instant = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}