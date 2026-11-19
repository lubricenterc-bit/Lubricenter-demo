import type { Metadata } from "next";
import Link from "next/link";
import { DemoPage } from "@/components/demo/demo-page";
import { PROJECTS } from "@/lib/demo/guide/projects";

export const metadata: Metadata = { title: "Proyectos · Lubricenter OS" };

const tone = (s: string) => (s === "En piloto" ? "daily" : s === "En construcción" ? "use" : "proj");

export default function Proyectos() {
  return (
    <DemoPage eyebrow="Versión de muestra" title="Proyectos en curso"
      lead="Lo que se está diseñando y construyendo. Cada proyecto tiene un prototipo navegable con datos ficticios: muestra cómo funcionará, pero no ejecuta nada.">
      <div className="demo-projects">
        {PROJECTS.map(p => (
          <article key={p.slug} className="demo-project">
            <span className={`demo-status demo-status--${tone(p.status)}`}>{p.status}</span>
            <h2>{p.title}</h2>
            <p>{p.problem}</p>
            <h3>Cómo funcionará</h3>
            <ul>{p.how.map(h => <li key={h}>{h}</li>)}</ul>
            <Link className="btn btn-primary" href={`/proyectos/${p.slug}/`}>Ver el prototipo</Link>
          </article>
        ))}
      </div>
    </DemoPage>
  );
}
