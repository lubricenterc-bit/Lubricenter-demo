"use client";

import Link from "next/link";

// Ninguna pantalla queda en blanco: si algo falla al mostrarla, se explica y se ofrece salida.
export default function DemoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="demo-unavailable">
      <p className="demo-unavailable__eyebrow">Versión de muestra</p>
      <h1>Esta pantalla no se pudo mostrar</h1>
      <p>Puede que use una función de la versión completa. Prueba de nuevo, reinicia la muestra desde la banda superior o vuelve al inicio.</p>
      <div className="demo-unavailable__actions">
        <button type="button" className="btn btn-primary" onClick={reset}>Probar de nuevo</button>
        <Link className="btn" href="/inicio/">Volver al inicio</Link>
        <Link className="btn" href="/proyectos/">Ver proyectos</Link>
      </div>
    </main>
  );
}
