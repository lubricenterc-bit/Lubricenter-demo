// Proyectos en curso de Lubricenter OS. Cada uno tiene un prototipo navegable hecho con
// datos ficticios; no ejecuta nada. Sin fechas de entrega.
export type ProjectStatus = "En diseño" | "En construcción" | "En piloto";
export type Block =
  | { kind: "fields"; rows: [string, string][] }
  | { kind: "list"; rows: { title: string; note?: string; pill?: string; tone?: "ok" | "warn" | "info" }[] }
  | { kind: "stages"; columns: { name: string; items: string[] }[] }
  | { kind: "chat"; lines: { from: "cliente" | "sistema" | "persona"; text: string }[] }
  | { kind: "checklist"; items: { text: string; done: boolean }[] }
  | { kind: "total"; label: string; value: string; note?: string }
  | { kind: "text"; text: string };
export type Screen = { title: string; caption: string; blocks: Block[]; action?: string };
export type Project = { slug: string; title: string; status: ProjectStatus; problem: string; how: string[]; screens: Screen[] };

export const PROJECTS: Project[] = [
  {
    slug: "taller-completo", title: "Taller completo", status: "En diseño",
    problem: "Hoy el taller se registra cuando el trabajo ya está hecho. Falta acompañar el vehículo desde que llega: lo que se recibió, la cotización que el cliente aprueba, el avance por etapas y la entrega con revisión de cortesía.",
    how: ["Recepción con kilometraje, nivel de combustible y fotos del vehículo.", "Cotización de mano de obra y repuestos que el cliente aprueba por WhatsApp antes de empezar.", "Tablero por etapas visible para el mostrador y el mecánico, con su app propia.", "Entrega con revisión de cortesía y recibo."],
    screens: [
      { title: "Recepción", caption: "El vehículo entra con su estado registrado.", action: "Crear cotización", blocks: [
        { kind: "fields", rows: [["Vehículo", "ZX233ZX · Toyota Hilux 2019"], ["Kilometraje", "128.400 km"], ["Combustible", "1/2"], ["Motivo", "Ruido al frenar"]] },
        { kind: "checklist", items: [{ text: "Foto frontal", done: true }, { text: "Foto lateral izquierda", done: true }, { text: "Foto del tablero", done: false }, { text: "Objetos de valor anotados", done: true }] },
      ] },
      { title: "Cotización para aprobar", caption: "El cliente aprueba antes de empezar el trabajo.", action: "Enviar al tablero", blocks: [
        { kind: "list", rows: [{ title: "Cambio de pastillas delanteras", note: "Mano de obra", pill: "$25,00" }, { title: "Kit de pastillas", note: "Compra para el trabajo (+10 %)", pill: "$38,50" }, { title: "Rectificar discos", note: "Mano de obra", pill: "$20,00" }] },
        { kind: "total", label: "Total cotizado", value: "$83,50", note: "Enviada por WhatsApp · aprobada por el cliente" },
      ] },
      { title: "Tablero por etapas", caption: "Cada vehículo avanza a la vista de todos.", action: "Entregar", blocks: [
        { kind: "stages", columns: [{ name: "Recibido", items: ["ZX149KC"] }, { name: "Diagnóstico", items: ["ZX303MK"] }, { name: "En trabajo", items: ["ZX233ZX", "ZX121FM"] }, { name: "Esperando repuesto", items: ["ZX380BB"] }, { name: "Listo", items: ["ZX198TD"] }] },
      ] },
      { title: "Entrega", caption: "Revisión de cortesía antes de devolver el vehículo.", blocks: [
        { kind: "checklist", items: [{ text: "Nivel de refrigerante", done: true }, { text: "Presión de cauchos", done: true }, { text: "Luces", done: true }, { text: "Prueba de manejo", done: true }] },
        { kind: "text", text: "Al confirmar, la orden pasa a cobro y el vehículo queda con su historial." },
      ] },
    ],
  },
  {
    slug: "nomina-semanal", title: "Nómina semanal", status: "En construcción",
    problem: "Liquidar cada semana exactamente lo que se registró, con adelantos descontados y sin rehacer cálculos de semanas anteriores.",
    how: ["Cada trabajo registrado genera la parte del mecánico en la semana en que se cobró.", "Los adelantos se descuentan en la semana en que se entregan.", "En ventas con Cashea, el mecánico cobra su parte completa el sábado; las cuotas las asume el negocio.", "Recibo de pago por persona."],
    screens: [
      { title: "Semana", caption: "Trabajos registrados en la semana.", action: "Ver adelantos", blocks: [
        { kind: "list", rows: [{ title: "DEMO-000182 · Cambio de amortiguadores", note: "Base $60,00 · 40 %", pill: "$24,00" }, { title: "DEMO-000177 · Correa de tiempo", note: "Base $45,00 · 40 %", pill: "$18,00" }, { title: "DEMO-000170 · Revisión de tren delantero", note: "Base $30,00 · 40 %", pill: "$12,00" }] },
        { kind: "total", label: "Mecánico de taller", value: "$54,00" },
      ] },
      { title: "Adelantos", caption: "Lo entregado durante la semana se descuenta.", action: "Liquidar", blocks: [
        { kind: "list", rows: [{ title: "Martes", note: "Efectivo", pill: "−$10,00", tone: "warn" }] },
        { kind: "total", label: "A pagar el sábado", value: "$44,00" },
      ] },
      { title: "Recibo", caption: "Comprobante para la persona.", blocks: [
        { kind: "fields", rows: [["Semana", "Lunes a sábado"], ["Trabajos", "3"], ["Adelantos", "$10,00"], ["Pagado", "$44,00"]] },
      ] },
    ],
  },
  {
    slug: "cupones", title: "Cupones de reactivación", status: "En diseño",
    problem: "Darle a los clientes que no vuelven una razón concreta para regresar, y medir quién vuelve gracias al cupón.",
    how: ["Campañas por tramo de recuperación (por ejemplo, más de 180 días sin volver).", "Cupón con código, vencimiento y condición (cambio de aceite completo).", "Se canjea en Venta rápida o en la orden y queda medido en Resultados."],
    screens: [
      { title: "Campaña", caption: "A quién va y qué ofrece.", action: "Ver cupón", blocks: [
        { kind: "fields", rows: [["Tramo", "Hace 181–365 días"], ["Clientes", "7"], ["Oferta", "Filtro de aceite de cortesía"], ["Vence", "30 días después del envío"]] },
      ] },
      { title: "Cupón", caption: "Lo que recibe el cliente por WhatsApp.", action: "Canjear", blocks: [
        { kind: "chat", lines: [{ from: "sistema", text: "¡Hola, Ana! Te extrañamos en Lubricenter. Con el código VUELVE-7Q2 tu próximo cambio de aceite incluye el filtro de cortesía." }] },
      ] },
      { title: "Canje", caption: "Se aplica en la venta y se mide.", blocks: [
        { kind: "list", rows: [{ title: "Cupón VUELVE-7Q2", note: "Filtro de cortesía", pill: "Aplicado", tone: "ok" }] },
        { kind: "text", text: "Resultados muestra cuántos clientes volvieron con cupón y cuánto compraron." },
      ] },
    ],
  },
  {
    slug: "modo-tunel", title: "Modo túnel", status: "En piloto",
    problem: "Las conciliaciones tienen muchos casos parecidos. El modo túnel los presenta uno a la vez, aprende de cada decisión y cierra con un informe.",
    how: ["Una decisión por pantalla, con la evidencia al lado.", "Cada decisión puede convertirse en una regla que resuelve casos iguales sola.", "Informe de cierre con el cuadre y lo que conviene mejorar."],
    screens: [
      { title: "Una decisión a la vez", caption: "El caso, la evidencia y las opciones.", action: "Guardar como regla", blocks: [
        { kind: "fields", rows: [["Movimiento", "Abono del 14/11 · Bs 3.200,00"], ["Referencia", "…4471"], ["Coincide con", "Cuota 2 de DEMO-000140"]] },
        { kind: "list", rows: [{ title: "Es de esta sede", pill: "Elegir", tone: "ok" }, { title: "Es de otra sede", pill: "Elegir", tone: "info" }, { title: "Dejar por confirmar", pill: "Elegir", tone: "warn" }] },
      ] },
      { title: "Regla aprendida", caption: "Lo que el sistema ya sabe resolver solo.", action: "Ver informe", blocks: [
        { kind: "text", text: "«Las facturas que empiezan por S2- son de la Sede 2.» Se aplicó a 12 casos." },
      ] },
      { title: "Informe de cierre", caption: "Cuadre del período y próximos pasos.", blocks: [
        { kind: "total", label: "Diferencia sin explicar", value: "Bs 0,00" },
        { kind: "list", rows: [{ title: "Casos resueltos", pill: "38" }, { title: "Resueltos por reglas", pill: "21" }, { title: "Por confirmar", pill: "2", tone: "warn" }] },
      ] },
    ],
  },
  {
    slug: "agente-whatsapp", title: "Agente de WhatsApp", status: "En diseño",
    problem: "Responder al instante las preguntas de siempre (precios, horarios, citas) y pasar a una persona lo que necesita criterio.",
    how: ["Responde con los precios y la disponibilidad del día.", "Propone citas para el cambio de aceite según el historial del vehículo.", "Traspasa a una persona cuando la conversación lo pide, con el resumen listo."],
    screens: [
      { title: "Conversación", caption: "Preguntas frecuentes respondidas al momento.", action: "Proponer cita", blocks: [
        { kind: "chat", lines: [{ from: "cliente", text: "Buenas, ¿cuánto sale el cambio de aceite para una Hilux?" }, { from: "sistema", text: "¡Hola! Para tu Hilux con 15W-40 semisintético: aceite y filtro desde $52 y la mano de obra es de cortesía. ¿Quieres agendar?" }] },
      ] },
      { title: "Cita propuesta", caption: "Según el historial del vehículo.", action: "Pasar a una persona", blocks: [
        { kind: "chat", lines: [{ from: "cliente", text: "Sí, el sábado en la mañana." }, { from: "sistema", text: "Listo: sábado 9:00 a. m. Te esperamos." }] },
      ] },
      { title: "Traspaso", caption: "Lo que necesita criterio va a una persona.", blocks: [
        { kind: "list", rows: [{ title: "Reclamo por un repuesto", note: "Resumen listo para Administración", pill: "Pendiente", tone: "warn" }] },
      ] },
    ],
  },
  {
    slug: "varias-sedes", title: "Varias sedes", status: "En piloto",
    problem: "Operar más de una sede con un solo sistema: inventario por sede, préstamos de mercancía entre sedes y cobros de Cashea separados por sede.",
    how: ["Cada sede ve su inventario y sus ventas; el dueño ve todo.", "Préstamos de mercancía con registro y devolución.", "La conciliación de Cashea reparte el dinero del banco por sede."],
    screens: [
      { title: "Sede", caption: "Cada persona trabaja en su sede.", action: "Prestar mercancía", blocks: [
        { kind: "list", rows: [{ title: "Centro", note: "Sede principal", pill: "Activa", tone: "ok" }, { title: "Sede 2", note: "En piloto", pill: "Activa", tone: "info" }] },
      ] },
      { title: "Préstamo entre sedes", caption: "La mercancía viaja con su registro.", action: "Ver resumen", blocks: [
        { kind: "fields", rows: [["Artículo", "Aceite Motul 10W-40 · 12 L"], ["De", "Centro"], ["A", "Sede 2"], ["Devolución", "En la próxima compra"]] },
      ] },
      { title: "Resumen por sede", caption: "Lo que le toca a cada una.", blocks: [
        { kind: "list", rows: [{ title: "Centro", pill: "Bs 71.146" }, { title: "Sede 2", pill: "Bs 0" }] },
      ] },
    ],
  },
  {
    slug: "ingreso-tablet", title: "Ingreso del vehículo desde tablet", status: "En diseño",
    problem: "Recibir el vehículo en la entrada, sin ir al mostrador: placa, cliente, motivo y conformidad del cliente en la tablet.",
    how: ["Se escribe o fotografía la placa y aparece el cliente.", "Lista de revisión rápida y motivo de la visita.", "El cliente firma la conformidad en pantalla y la orden queda creada."],
    screens: [
      { title: "Placa", caption: "Se identifica el vehículo al llegar.", action: "Revisión", blocks: [
        { kind: "fields", rows: [["Placa", "ZX177PS"], ["Cliente", "Miguel Rocamar"], ["Último cambio", "Hace 92 días"]] },
      ] },
      { title: "Revisión", caption: "Lo esencial en pocos toques.", action: "Firma", blocks: [
        { kind: "checklist", items: [{ text: "Cambio de aceite", done: true }, { text: "Revisar frenos", done: false }, { text: "Rayones anotados", done: true }] },
      ] },
      { title: "Firma", caption: "El cliente da su conformidad.", blocks: [
        { kind: "text", text: "Al firmar se crea la orden y el vehículo entra al tablero del taller." },
      ] },
    ],
  },
];
