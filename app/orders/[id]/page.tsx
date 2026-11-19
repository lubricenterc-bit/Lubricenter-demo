import { staticIds } from "@/lib/demo/static-ids";
import { OrderWorkspace } from "@/components/order-workspace";
export function generateStaticParams() {
  return staticIds("orders").map((id) => ({ id }));
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="container stack"><OrderWorkspace key={id} initialOrderId={id} /></main>;
}

