import Link from "next/link";

export default function Page() {
  return (
    <main className="demo-cover">
      <p className="demo-cover__eyebrow">Versión de muestra</p>
      <h1>Cómo está construido</h1>
      <p className="demo-cover__lead">Los principios con los que está hecho Lubricenter OS: aplicación web instalable, datos protegidos por permisos, escrituras solo por funciones del servidor, auditoría de cambios sensibles y pruebas automáticas en cada cambio.</p>
      <div className="demo-cover__actions"><Link className="btn btn-primary" href="/">Volver a la portada</Link><Link className="btn" href="/login/">Usar la muestra</Link></div>
    </main>
  );
}
