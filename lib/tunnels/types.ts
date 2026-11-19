import type { SupabaseClient } from "@supabase/supabase-js";
import type { OsIconName } from "@/components/os-icon";

/**
 * Modo túnel: el proceso entrega casos, acciones reversibles, el cuadre y herramientas de
 * lectura; el motor pone todo lo demás (pantalla completa, progreso, teclado y gestos,
 * «No → explicar», reglas aprendidas, deshacer, historial, resumen e informe de cierre).
 * Ver docs/tunnels.md. Este archivo no importa React ni el navegador: lo usan también las
 * pruebas y la ruta de la IA en el servidor.
 */

/** Escalón de esfuerzo de un caso. Los `auto` del mismo grupo se aprueban juntos en un lote. */
export type CaseLevel = "auto" | "confirm" | "choice" | "input" | "upload";
export type DecisionSlideKind = "batch" | "confirm" | "choice" | "input" | "upload";
export type TunnelAnswer = "YES" | "NO" | "OPTION" | "INPUT" | "SKIP";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
/** Datos de un caso que una regla aprendida puede mirar (factura, cédula, monto…). */
export type Facts = Record<string, string | number | boolean | null>;

export interface TunnelAction {
  /** Tipo registrado, p. ej. `cashea.assign_branch`. `tunnel.batch` es el lote. */
  type: string;
  payload: JsonObject;
  /** Texto del botón: «Sí, es de Sede 2». */
  label: string;
  /** Una línea debajo del botón cuando es una opción («Queda como saldo a favor del cliente»). */
  hint?: string;
}

export interface TunnelChoice { value: string; label: string }

export interface TunnelInput {
  label: string;
  type: "money" | "text" | "select";
  choices?: TunnelChoice[];
  /** Tipo de acción que corre con `{ ...basePayload, value }`. */
  action: string;
  basePayload?: JsonObject;
  /** Texto del botón; por defecto «Guardar». */
  submitLabel?: string;
  placeholder?: string;
  /** «Bs», «USD». */
  unit?: string;
}

/** Diapositiva para subir un archivo que falta (no se avanza sin él si `blocking`). */
export interface TunnelUpload {
  accept: string;
  /** Qué archivo y de dónde se descarga, en una frase. */
  hint: string;
  submitLabel?: string;
}

export interface DetailRow { label: string; value: string; tone?: Tone; mono?: boolean }
export interface DetailBlock {
  title?: string;
  rows?: DetailRow[];
  text?: string;
  table?: { columns: string[]; rows: string[][] };
}
export type Tone = "neg" | "ok" | "warn" | "muted";

export interface TunnelCase {
  /** Estable entre recargas (derivado del registro de origen). */
  id: string;
  level: CaseLevel;
  /** Tramo del recorrido («Archivos», «Abonos», «Retiros»…); agrupa el resumen y el informe. */
  section?: string;
  /** Qué es y de dónde viene: «Abono BNC · 25/10 · ref 0011987». */
  eyebrow: string;
  /** La cifra o dato grande. */
  headline: string;
  /** Una línea pequeña debajo de la cifra («≈ 38,20 USD a la tasa de Cashea»). */
  headlineNote?: string;
  /** Una sola pregunta. */
  question: string;
  /** De una a tres líneas de evidencia. */
  context: string[];
  /** Se ve en «Ver detalle» sin salir del túnel. */
  detail?: DetailBlock[];
  /** 0–1. */
  confidence: number;
  tone?: "default" | "warn" | "danger";
  proposal?: TunnelAction;
  /** Opciones (de 2 a 4). En un caso de sí o no, también son lo que se ofrece después de un «No». */
  options?: TunnelAction[];
  input?: TunnelInput;
  upload?: TunnelUpload;
  /** No se puede apartar (p. ej. la cadena de saldos rota: sin el archivo no hay cuadre). */
  blocking?: boolean;
  /** Los casos `auto` del mismo grupo forman un lote. */
  batchGroup?: string;
  facts?: Facts;
  /**
   * Claves del registro de este caso (p. ej. `{ subject_key }`). Una regla aprendida no las
   * guarda; cuando se aplica a otro caso, se usan las de ese caso.
   */
  subject?: JsonObject;
  /** Monto del caso en su moneda, para el informe (no se muestra tal cual). */
  amount?: number;
  /** Lo pone el motor cuando la propuesta vino de una regla aprendida. */
  ruleId?: string;
  ruleDescription?: string;
}

export type RuleOperator = "eq" | "neq" | "in" | "contains" | "startsWith" | "gte" | "lte" | "between";
export interface RuleClause { fact: string; op: RuleOperator; value: JsonValue }
export interface RuleCondition { all: RuleClause[] }
export interface RuleOutcome { action: { type: string; payload: JsonObject; label?: string } }
export type RuleStatus = "ACTIVE" | "DISABLED" | "PENDING_APPROVAL";

export interface TunnelRule {
  id: string;
  tunnel_key: string;
  condition: RuleCondition;
  outcome: RuleOutcome;
  description: string;
  status: RuleStatus;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  source_decision_id: string | null;
}

/** Borrador de regla que sale de una decisión («Recordar esto como regla»). */
export interface RuleDraft { condition: RuleCondition; outcome: RuleOutcome; description: string }

export interface BalanceRow { label: string; cells: string[]; emphasis?: boolean; tone?: Tone }
export interface TunnelBalance {
  ok: boolean;
  /** «El BNC tiene 652.859,68 Bs y está repartido así». */
  title: string;
  total: string;
  table?: { columns: string[]; rows: BalanceRow[] };
  /** Fila de control, p. ej. «Saldo del BNC: 652.859,68 Bs». */
  control?: { label: string; value: string };
  /** En rojo cuando no cuadra. */
  diff?: string;
  note?: string;
}

export interface TunnelCover {
  /** «Vamos a cuadrar Cashea». */
  title: string;
  /** Qué revisó el sistema, una línea cada cosa. */
  lines: string[];
  /** Frescura de cada archivo o fuente. */
  sources?: { label: string; value: string; ok: boolean }[];
}

export interface BatchDescription {
  eyebrow: string;
  headline: string;
  question: string;
  context: string[];
  label: string;
  /** Desglose del lote (p. ej. por sucursal). */
  breakdown?: { label: string; value: string }[];
}

export interface TunnelContext {
  supabase: SupabaseClient | null;
  /** AAAA-MM-DD en Venezuela. */
  today: string;
  /** Reglas activas de este proceso. */
  rules: TunnelRule[];
  /** Casos ya resueltos en sesiones cerradas (no vuelven a preguntarse). */
  prior: Set<string>;
  /** Estado de los túneles de memoria (demo y pruebas). */
  memory?: Record<string, unknown>;
}

export interface AiToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  /** Solo lectura. Devuelve datos para el modelo; nunca aplica nada. */
  run(input: Record<string, unknown>, ctx: TunnelContext): Promise<unknown>;
}

/** Implementación local de una acción, para túneles en memoria. */
export interface LocalHandler {
  apply(payload: JsonObject, memory: Record<string, unknown>): JsonObject;
  revert(revert: JsonObject, memory: Record<string, unknown>): void;
}

export interface Insight {
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  /** Qué hacer, en una frase. */
  action?: string;
}

export interface ReportChart { title: string; unit?: string; rows: { label: string; value: number; display: string }[] }

/** Informe de cierre: lo que se le pasa a quien lo necesite para enterarse rápido. */
export interface TunnelReport {
  version: 1;
  tunnelKey: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  person?: string | null;
  durationSeconds?: number;
  balance: TunnelBalance;
  closeNote?: string | null;
  metrics: { label: string; value: string; hint?: string }[];
  decisions: { section: string; items: { title: string; detail: string; answer: string }[] }[];
  setAside: { title: string; detail: string; reason?: string | null }[];
  rules: { created: string[]; used: { description: string; times: number }[] };
  insights: Insight[];
  charts: ReportChart[];
  tables: { title: string; columns: string[]; rows: string[][] }[];
  /** Resumen corto para pegar en WhatsApp. */
  text: string;
}

/** Lo que el proceso agrega al informe con su propio análisis. */
export type ProcessReport = Partial<Pick<TunnelReport, "title" | "subtitle" | "metrics" | "insights" | "charts" | "tables">> & { textLines?: string[] };

export interface ReportInput {
  decisions: { item: Pick<TunnelCase, "id" | "section" | "eyebrow" | "headline" | "facts" | "amount">; answer: TunnelAnswer; label: string; explanation?: string | null }[];
  balance: TunnelBalance;
}

export interface TunnelDefinition<Data = unknown> {
  key: string;
  title: string;
  /** Una línea para la tarjeta de «Túneles pendientes». */
  description: string;
  /** Permiso que revisa la base (`tunnels.<key>`). */
  permission: string;
  icon: OsIconName;
  /** Vista manual del mismo proceso. */
  manualHref?: string;
  /** Módulo del dueño: para Administración pide PIN, como la vista manual. */
  sensitive?: boolean;
  /** `memory` nunca toca la base (demo y pruebas). */
  backend: "supabase" | "memory";
  /** Trae los datos una vez por recorrido. */
  load(ctx: TunnelContext): Promise<Data>;
  cover(ctx: TunnelContext, data: Data): TunnelCover;
  /** Casos ordenados. Lo ya resuelto no debe volver. */
  buildCases(ctx: TunnelContext, data: Data): TunnelCase[];
  describeBatch?(group: string, items: TunnelCase[], data: Data): BatchDescription;
  balance(ctx: TunnelContext, data: Data): TunnelBalance;
  /** Acción final reversible antes de cerrar (p. ej. guardar el corte). */
  closeAction?(ctx: TunnelContext, data: Data, balance: TunnelBalance): TunnelAction | null;
  /** Análisis del proceso para el informe de cierre. */
  report?(ctx: TunnelContext, data: Data, input: ReportInput): ProcessReport;
  /** Subir un archivo desde una diapositiva `upload`. Devuelve un aviso corto. */
  upload?(files: File[], ctx: TunnelContext, data: Data): Promise<string>;
  /** Regla que se puede aprender de una decisión; `null` si no se puede generalizar. */
  ruleFromDecision?(item: TunnelCase, action: TunnelAction): RuleDraft | null;
  ruleMatcher?(rule: TunnelRule, item: TunnelCase): boolean;
  /** Nombres en palabras de los datos que usan las reglas («invoice» → «La factura»). */
  factLabels?: Record<string, string>;
  aiTools: AiToolDef[];
  /** Explicación corta del proceso para la IA. */
  aiInstructions: string;
  localHandlers?: Record<string, LocalHandler>;
  seedMemory?(): Record<string, unknown>;
}

/** Forma exacta que debe devolver la IA (se valida antes de usarla). */
export interface AiAnswer {
  summary: string;
  proposal: TunnelAction | null;
  ruleSuggestion?: RuleDraft;
}
