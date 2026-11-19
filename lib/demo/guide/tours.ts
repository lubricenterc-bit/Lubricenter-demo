// Recorridos guiados y anotaciones del modo prototipo. Cada paso resalta un elemento
// de la pantalla real; si el elemento no está, el paso se muestra centrado igual.
export type TourStep = { route: string; selector?: string; title: string; text: string };
export type Tour = { id: string; title: string; minutes: number; steps: TourStep[] };

export const MAIN_TOUR: Tour = {
  id: "principal", title: "Recorrido principal", minutes: 5,
  steps: [
    { route: "/inicio/", selector: "main h1", title: "1 · El día en una pantalla", text: "Inicio resume lo vendido y cobrado hoy, la ganancia del día y los pendientes ordenados por urgencia. Cada perfil ve su propio inicio." },
    { route: "/inicio/", selector: ".os-home-actions, [class*='actions']", title: "2 · Lo que más se hace, a un toque", text: "Vender, cambio de aceite, trabajo de taller o electroauto y cotizar. Cada acceso lleva a un solo lugar: no hay dos caminos al mismo destino." },
    { route: "/quick-sale/", selector: "input[placeholder^='Ej: Valvoline']", title: "3 · Venta rápida", text: "Se busca por marca, código o viscosidad. Enter agrega el primero. Los precios están en REF a tasa BCV y se ven también en bolívares." },
    { route: "/quick-sale/", selector: ".os-charge", title: "4 · Cobro con vuelto", text: "El botón dice exactamente lo que falta para cobrar. En efectivo se confirma el dinero contado y el sistema calcula el vuelto en dólares a la tasa operativa." },
    { route: "/print/receipt/ord-0010/", selector: "main", title: "5 · Recibo de 58 mm", text: "Nota de entrega para impresora térmica: blanco y negro, total en bloque y el próximo cambio de aceite del vehículo." },
    { route: "/orders/ord-0010/", selector: "main section", title: "6 · Cambio de aceite", text: "Cada orden une cliente, vehículo, productos y cobro. La mano de obra del cambio es gratis si el cliente compra aquí al menos el 85 % del cambio; si no, se cobra." },
    { route: "/cashea/conciliacion/", selector: ".demo-samples", title: "7 · Cashea verificado con el banco", text: "Con los reportes de Cashea y el estado de cuenta, una cuota se marca pagada solo con verificación al 100 %. Pulsa «Usar archivos de ejemplo» y luego «Cargar reportes»." },
    { route: "/crm/", selector: "main h1", title: "8 · Seguimiento de clientes", text: "El sistema elige a quién escribir hoy para su próximo cambio, con el mensaje listo y un tope diario. Recuperar agrupa a los clientes por cuánto se les pasó el cambio." },
    { route: "/finance/profit/", selector: "main h1", title: "9 · Ganancias", text: "Tienda y taller por separado, ítem por ítem: precio menos costo en tienda; mano de obra menos mecánico y comisión de Cashea en taller." },
    { route: "/proyectos/", selector: "main h1", title: "10 · Lo que viene", text: "Los proyectos en curso, cada uno con un prototipo navegable marcado como «no funcional»." },
  ],
};

export const TOURS: Tour[] = [MAIN_TOUR];

export type Annotation = { selector: string; text: string };

/** Anotaciones numeradas por pantalla (decisiones de diseño y reglas a la vista). */
export const ANNOTATIONS: Record<string, Annotation[]> = {
  "/quick-sale": [
    { selector: ".os-charge", text: "El botón dice exactamente lo que falta para cobrar: nunca un «Continuar» genérico." },
    { selector: "input[placeholder^='Ej: Valvoline']", text: "Un solo buscador para marca, código, viscosidad o rubro; Enter agrega el primero." },
  ],
  "/inicio": [
    { selector: "main h1", text: "El saludo resume el día en una frase: ventas, cobros y mensajes pendientes." },
  ],
  "/orders": [
    { selector: "main h1", text: "La lista separa lo vendido de lo cobrado y no duplica la inicial de Cashea." },
  ],
  "/cashea/conciliacion": [
    { selector: ".demo-samples", text: "Reportes de ejemplo con el mismo formato que los reales: pasan por el mismo importador." },
  ],
  "/crm": [
    { selector: "main h1", text: "El sistema decide a quién escribir; la persona solo envía y anota la respuesta." },
  ],
  "/receivables": [
    { selector: "main h1", text: "Cada deuda se guarda en dos monedas a la vez para que no pierda valor ni deje restos." },
  ],
  "/finance/profit": [
    { selector: "main h1", text: "Sin gastos: es la ganancia de cada venta. El balance se hace aparte." },
  ],
};
