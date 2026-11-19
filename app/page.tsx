import Link from "next/link";

const GROUPS: { title: string; items: string[] }[] = [
  { title: "Operación", items: ["Venta rápida y cobro", "Órdenes y recibo de 58 mm", "Cambio de aceite", "Cotizador"] },
  { title: "Clientes", items: ["Clientes y vehículos", "Historial de mantenimiento", "Seguimiento de clientes"] },
  { title: "Inventario y compras", items: ["Inventario y catálogo", "Ingresar mercancía", "Proveedores y facturas"] },
  { title: "Cobros y finanzas", items: ["Cuentas por cobrar y crédito", "Cashea: cuotas y conciliación", "Ganancias de tienda y taller"] },
  { title: "Administración", items: ["Perfiles y permisos", "Configuración del recibo y los mensajes"] },
];

export default function Portada() {
  return (
    <main className="demo-cover">
      <header className="demo-cover__hero">
        <p className="demo-cover__eyebrow">Versión de muestra · datos ficticios</p>
        <h1>Lubricenter OS</h1>
        <p className="demo-cover__lead">
          Sistema de gestión para centros de lubricación y taller. Reúne en un solo lugar las ventas,
          el inventario, los cobros en varias monedas, el financiamiento con cuotas, el seguimiento
          de clientes y las ganancias de cada venta.
        </p>
        <p className="demo-cover__lead">
          Esta muestra funciona en el navegador, sin conexión a ningún servicio. Lo que hagas se guarda
          solo en tu navegador y puedes reiniciarlo cuando quieras.
        </p>
        <div className="demo-cover__actions">
          <Link className="btn btn-primary" href="/login/">Usar la muestra</Link>
          <Link className="btn" href="/login/?modo=prototipo">Ver en modo prototipo</Link>
        </div>
      </header>

      <section className="demo-cover__map" aria-labelledby="mapa">
        <h2 id="mapa">Qué incluye</h2>
        <div className="demo-cover__grid">
          {GROUPS.map(group => (
            <article key={group.title} className="demo-cover__group">
              <h3>{group.title}</h3>
              <ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="demo-cover__links">
        <Link href="/como-esta-construido/">Cómo está construido</Link>
        <Link href="/proyectos/">Proyectos en curso</Link>
        <Link href="/glosario/">Glosario</Link>
      </section>
    </main>
  );
}
