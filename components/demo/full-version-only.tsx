import Link from "next/link";

// Pantalla que reemplaza a los módulos que no forman parte de la muestra.
// Nunca una pantalla en blanco: dice qué es y dónde ver más.
export function FullVersionOnly({ title, reason }: { title: string; reason?: string }) {
  return (
    <main className="demo-unavailable">
      <p className="demo-unavailable__eyebrow">Versión completa</p>
      <h1>{title}</h1>
      <p>{reason ?? "Este módulo está en la versión completa de Lubricenter OS. En la muestra se presenta como proyecto."}</p>
      <div className="demo-unavailable__actions">
        <Link className="btn btn-primary" href="/proyectos/">Ver proyectos</Link>
        <Link className="btn" href="/">Volver al inicio</Link>
      </div>
    </main>
  );
}
