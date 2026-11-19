import type { SupabaseClient } from "@supabase/supabase-js";
// Esqueleto F1: se reemplaza por el cliente completo en F2/F3.
const notAvailable = { data: null, error: { message: "Esta función está en la versión completa.", code: "DEMO_NO_DISPONIBLE" } };
function builder(): any { const b: any = new Proxy(function () {}, { get: (_t, p) => p === "then" ? (r: any) => r(notAvailable) : () => b, apply: () => b }); return b; }
const demoClient = {
  from: () => builder(),
  rpc: async () => notAvailable,
  auth: {
    getSession: async () => ({ data: { session: { access_token: "demo", user: { id: "demo-user", email: "dueno@ejemplo.com" } } }, error: null }),
    getUser: async () => ({ data: { user: { id: "demo-user", email: "dueno@ejemplo.com" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
  },
};

export const supabase = demoClient as unknown as SupabaseClient;
