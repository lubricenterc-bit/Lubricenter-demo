import { FullVersionOnly } from "@/components/demo/full-version-only";

export function generateStaticParams() {
  return [{ key: "cashea" }, { key: "crm" }];
}

export default function Page() {
  return <FullVersionOnly title="Modo túnel" reason="El modo túnel resuelve la conciliación una decisión a la vez. Está en piloto: mira el prototipo en Proyectos." />;
}
