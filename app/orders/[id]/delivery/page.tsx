import { FullVersionOnly } from "@/components/demo/full-version-only";
import { staticIds } from "@/lib/demo/static-ids";

export function generateStaticParams() {
  return staticIds("orders").map((id) => ({ id }));
}

export default function Page() {
  return <FullVersionOnly title="Entrega del vehículo" reason="La entrega con revisión de cortesía es parte del proyecto «Taller completo». Mira el prototipo en Proyectos." />;
}
