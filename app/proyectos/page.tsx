import Link from "next/link";

export default function Page() {
  return (
    <main className="demo-cover">
      <p className="demo-cover__eyebrow">Versión de muestra</p>
      <h1>Proyectos en curso</h1>
      <p className="demo-cover__lead">Aquí verás los proyectos de Lubricenter OS con su estado y un prototipo navegable de cada uno: taller completo, nómina semanal, cupones de reactivación, modo túnel, agente de WhatsApp, varias sedes e ingreso del vehículo desde tablet.</p>
      <div className="demo-cover__actions"><Link className="btn btn-primary" href="/">Volver a la portada</Link><Link className="btn" href="/login/">Usar la muestra</Link></div>
    </main>
  );
}
