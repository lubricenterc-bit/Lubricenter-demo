// Rutas de la muestra que se ven sin el menú del sistema (portada y páginas informativas).
export const DEMO_BARE_PATHS = ["/", "/login", "/proyectos", "/glosario", "/como-esta-construido"];

export function normalizePath(pathname: string | null | undefined) {
  if (!pathname) return "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isDemoBarePath(pathname: string | null | undefined) {
  const p = normalizePath(pathname);
  return DEMO_BARE_PATHS.some(base => p === base || (base !== "/" && p.startsWith(base + "/")));
}
