import Link from "next/link";
import type { ReactNode } from "react";

/** Marco de las páginas informativas de la muestra (portada, proyectos, glosario…). */
export function DemoPage({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="os-theme demo-page">
      <header className="demo-page__top">
        <Link href="/" className="demo-page__brand" aria-label="Portada de la versión de muestra">Lubricenter <b>OS</b></Link>
        <nav aria-label="Páginas de la muestra">
          <Link href="/proyectos/">Proyectos</Link>
          <Link href="/glosario/">Glosario</Link>
          <Link href="/como-esta-construido/">Cómo está construido</Link>
          <Link className="btn btn-primary" href="/login/">Usar la muestra</Link>
        </nav>
      </header>
      <main className="demo-page__main">
        {eyebrow && <p className="demo-cover__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <p className="demo-cover__lead">{lead}</p>}
        {children}
      </main>
      <footer className="demo-page__foot">Versión de muestra con datos ficticios. No está conectada a ningún servicio.</footer>
    </div>
  );
}
