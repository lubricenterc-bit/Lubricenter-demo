// Registro de manejadores: cada RPC que usan las pantallas visibles de la muestra.
// Lo que no esté aquí responde «Esta función está en la versión completa».
import type { Handler } from "./ctx";
import { session } from "./session";
import { crm } from "./crm";
import { sales } from "./sales";
import { orders } from "./orders";
import { receivables } from "./receivables";
import { customers } from "./customers";
import { oil } from "./oil";

export const HANDLERS: Record<string, Handler> = {
  ...session, ...crm, ...sales, ...orders, ...receivables, ...customers, ...oil,
};
