import type { Metadata } from "next";
import { DemoPage } from "@/components/demo/demo-page";

export const metadata: Metadata = { title: "Cómo está construido · Lubricenter OS" };

const PRINCIPLES = [
  { title: "Aplicación web instalable", text: "Funciona en computadora, tablet y teléfono desde el navegador, y se puede instalar como aplicación. Una sola versión para todo el equipo." },
  { title: "Datos protegidos por permisos", text: "La base de datos es Postgres con seguridad por fila: cada persona solo puede leer lo que su perfil permite." },
  { title: "Escrituras solo por funciones del servidor", text: "Ninguna pantalla escribe directo en las tablas. Cada venta, cobro o ajuste pasa por una función que valida las reglas del negocio y los permisos." },
  { title: "Dinero sin redondeos accidentales", text: "Los montos se calculan con aritmética decimal exacta y cada línea guarda las tasas del momento en que se vendió." },
  { title: "Auditoría de cambios sensibles", text: "Descuentos, correcciones de ventas cerradas, ediciones de facturas y ajustes de inventario quedan registrados con quién, cuándo y por qué." },
  { title: "Ventas cerradas protegidas", text: "Una orden cerrada no se edita: se corrige con un movimiento nuevo y su motivo, para que los reportes de días pasados no cambien solos." },
  { title: "PIN para operaciones sensibles", text: "Los descuentos grandes y los módulos del dueño piden un PIN, con bloqueo tras varios intentos." },
  { title: "Pruebas automáticas en cada cambio", text: "Cada cambio pasa por pruebas de las reglas de dinero (redondeo, recargo de Cashea, deudas en dos monedas) antes de publicarse." },
];

export default function Construido() {
  return (
    <DemoPage eyebrow="Versión de muestra" title="Cómo está construido" lead="Los principios con los que está hecho Lubricenter OS. Esta muestra usa las mismas pantallas, con una capa de datos de ejemplo que vive en tu navegador.">
      <div className="demo-cards">
        {PRINCIPLES.map(p => (
          <article key={p.title} className="demo-card"><h2>{p.title}</h2><p>{p.text}</p></article>
        ))}
      </div>
      <section className="demo-note-box">
        <h2>Sobre esta muestra</h2>
        <p>Es un sitio estático: no se conecta a ningún servicio ni envía datos. Las reglas de negocio de la muestra se tomaron del sistema real y tienen sus propias pruebas. Los clientes, vehículos, montos y tasas son inventados.</p>
      </section>
    </DemoPage>
  );
}
