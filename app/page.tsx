import Link from "next/link";
import { DemoPage } from "@/components/demo/demo-page";
import { PROJECTS } from "@/lib/demo/guide/projects";

const GROUPS: { title: string; items: [string, string][] }[] = [
  { title: "Operación", items: [["Venta rápida y cobro", "En uso diario"], ["Órdenes y recibo de 58 mm", "En uso diario"], ["Cambio de aceite", "En uso diario"], ["Cotizador", "En uso"]] },
  { title: "Clientes", items: [["Clientes y vehículos", "En uso diario"], ["Historial de mantenimiento", "En uso diario"], ["Seguimiento de clientes", "En uso diario"]] },
  { title: "Inventario y compras", items: [["Inventario y catálogo", "En uso diario"], ["Ingresar mercancía", "En uso"], ["Proveedores y facturas", "En uso"]] },
  { title: "Cobros y finanzas", items: [["Cashea: cuotas y conciliación", "En uso diario"], ["Crédito LC", "En uso"], ["Ganancias de tienda y taller", "En uso"]] },
  { title: "Administración", items: [["Perfiles y permisos", "En uso"], ["Recibo, cobros y mensajes", "En uso"]] },
];

export default function Portada() {
  return (
    <DemoPage eyebrow="Versión de muestra · datos ficticios" title="Lubricenter OS"
      lead="Sistema de gestión para centros de lubricación y taller. Reúne en un solo lugar las ventas, el inventario, los cobros en varias monedas, el financiamiento con cuotas, el seguimiento de clientes y la ganancia de cada venta.">
      <p className="demo-cover__lead">Esta muestra usa las pantallas reales del sistema con datos inventados. Funciona en el navegador, sin conexión a ningún servicio: lo que hagas se guarda solo aquí y puedes reiniciarlo cuando quieras.</p>
      <div className="demo-cover__actions">
        <Link className="btn btn-primary" href="/login/">Usar la muestra</Link>
        <Link className="btn" href="/login/?modo=prototipo">Ver en modo prototipo</Link>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>El modo prototipo empieza con un recorrido guiado de unos 5 minutos y muestra notas sobre cada pantalla.</p>

      <section className="demo-cover__map" aria-labelledby="mapa">
        <h2 id="mapa">Qué incluye</h2>
        <div className="demo-cover__grid">
          {GROUPS.map(group => (
            <article key={group.title} className="demo-cover__group">
              <h3>{group.title}</h3>
              <ul>{group.items.map(([name, status]) => <li key={name}><span>{name}</span><small className={status === "En uso diario" ? "demo-dot demo-dot--daily" : "demo-dot"}>{status}</small></li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-cover__map" aria-labelledby="proy">
        <h2 id="proy">Proyectos en curso</h2>
        <div className="demo-cover__grid">
          {PROJECTS.map(p => (
            <Link key={p.slug} href={`/proyectos/${p.slug}/`} className="demo-cover__group demo-cover__link">
              <h3>{p.title}</h3><small className="demo-dot">{p.status}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="demo-note-box">
        <h2>Cómo está construido</h2>
        <p>Aplicación web instalable, datos protegidos por permisos, escrituras solo por funciones del servidor, auditoría de cambios sensibles y pruebas automáticas en cada cambio. <Link href="/como-esta-construido/" style={{ textDecoration: "underline" }}>Ver los principios</Link>.</p>
      </section>
    </DemoPage>
  );
}
