// Cliente de la muestra: misma interfaz que el cliente de Supabase que usan las
// pantallas (.from, .rpc, .auth), pero todo ocurre en el navegador, sin red.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DemoQuery } from "./query";
import { getProfile, getState, notifyUnavailable, setProfile, DEMO_EVENT_CHANGED } from "./store";
import { HANDLERS } from "./rpc";
import { DemoError, makeCtx } from "./rpc/ctx";

const UNAVAILABLE = { message: "Esta función está en la versión completa de Lubricenter OS.", code: "DEMO_NO_DISPONIBLE", details: null, hint: null };

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const handler = HANDLERS[name];
  if (!handler) { notifyUnavailable(name); return { data: null, error: UNAVAILABLE, count: null, status: 404, statusText: "Not Found" }; }
  try {
    const s = await getState();
    const data = await handler(args ?? {}, makeCtx(s));
    return { data: data === undefined ? null : data, error: null, count: null, status: 200, statusText: "OK" };
  } catch (e) {
    if (!(e instanceof DemoError) && typeof console !== "undefined") console.warn(`[muestra] ${name}:`, e);
    const message = e instanceof DemoError ? e.message : "No se pudo completar en la muestra. Prueba de nuevo o reinicia la muestra.";
    return { data: null, error: { message, code: "DEMO", details: null, hint: null }, count: null, status: 400, statusText: "Bad Request" };
  }
}

function session() {
  const profile = getProfile();
  if (!profile) return null;
  const id = `stf-${profile.toLowerCase()}`;
  return { access_token: "muestra", token_type: "bearer", expires_in: 3600, refresh_token: "muestra", user: { id, email: `${profile.toLowerCase()}@ejemplo.com`, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } };
}

type AuthCb = (event: string, s: ReturnType<typeof session>) => void;
const listeners = new Set<AuthCb>();
if (typeof window !== "undefined") {
  let last = getProfile();
  window.addEventListener(DEMO_EVENT_CHANGED, () => {
    const now = getProfile();
    if (now === last) return;
    last = now;
    for (const cb of listeners) cb(now ? "SIGNED_IN" : "SIGNED_OUT", session());
  });
}

const demoClient = {
  from: (name: string) => new DemoQuery(name),
  rpc: (name: string, args?: Record<string, unknown>) => rpc(name, args as Record<string, unknown>),
  auth: {
    getSession: async () => ({ data: { session: session() }, error: null }),
    getUser: async () => ({ data: { user: session()?.user ?? null }, error: null }),
    onAuthStateChange: (cb: AuthCb) => { listeners.add(cb); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
    signInWithPassword: async () => ({ data: { session: session(), user: session()?.user ?? null }, error: getProfile() ? null : { message: "Elige un perfil para entrar a la muestra." } }),
    signOut: async () => { setProfile(null); return { error: null }; },
    updateUser: async () => ({ data: { user: session()?.user ?? null }, error: null }),
  },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() { return Promise.resolve("ok"); } }),
  removeChannel: async () => "ok",
};

export const supabase = demoClient as unknown as SupabaseClient;
