import type { Metadata } from "next";
import { DemoPage } from "@/components/demo/demo-page";
import { GLOSSARY } from "@/lib/demo/guide/modules";

export const metadata: Metadata = { title: "Glosario · Lubricenter OS" };

export default function Glosario() {
  return (
    <DemoPage eyebrow="Versión de muestra" title="Glosario" lead="Los términos del negocio que aparecen en las pantallas, explicados en palabras simples.">
      <dl className="demo-glossary">
        {GLOSSARY.map(g => (
          <div key={g.id} id={g.id} className="demo-glossary__item">
            <dt>{g.term}</dt>
            <dd>{g.text}</dd>
          </div>
        ))}
      </dl>
    </DemoPage>
  );
}
