import { FullVersionOnly } from "@/components/demo/full-version-only";
import { staticIds } from "@/lib/demo/static-ids";

export function generateStaticParams() {
  return staticIds("orders").map((id) => ({ id }));
}

export default function Page() {
  return <FullVersionOnly title="Correcciones de órdenes cerradas" reason="Corregir una venta ya cerrada (pagos, servicios o entrega) es una herramienta interna con auditoría. Está en la versión completa." />;
}
