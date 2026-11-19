// Rutas del modo túnel. Sin dependencias (lo usan el shell y las pruebas).

export const TUNNELS_HOME = "/tunnels";
export const TUNNELS_RULES = "/tunnels/rules";
export const TUNNELS_REPORTS = "/tunnels/informes";
const RESERVED = new Set(["rules", "informes"]);

/** `/tunnels/<key>`: el túnel a pantalla completa (fuera del shell normal). */
export function tunnelKeyFromPath(path: string): string | null {
  const m = /^\/tunnels\/([a-z][a-z0-9_]{1,39})\/?$/.exec(path);
  return m && !RESERVED.has(m[1]) ? m[1] : null;
}

/** `/tunnels/informes/<id>`: el informe de cierre como documento. */
export function reportIdFromPath(path: string): string | null {
  const m = /^\/tunnels\/informes\/([0-9a-f-]{36})\/?$/i.exec(path);
  return m ? m[1] : null;
}

/** Pantallas que se ven sin cabecera, menú ni barra inferior. */
export function isTunnelFullscreen(path: string): boolean {
  return tunnelKeyFromPath(path) !== null || reportIdFromPath(path) !== null;
}

/** El demo se puede ver sin iniciar sesión solo en desarrollo y con la bandera explícita (capturas y pruebas). */
export function isPublicDemoPath(path: string, env: { NODE_ENV?: string; NEXT_PUBLIC_TUNNEL_DEMO_PUBLIC?: string }): boolean {
  return env.NODE_ENV !== "production" && env.NEXT_PUBLIC_TUNNEL_DEMO_PUBLIC === "1" && (path === "/tunnels" || path.startsWith("/tunnels/"));
}
