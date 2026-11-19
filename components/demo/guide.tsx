"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePath, isDemoBarePath } from "@/lib/demo/paths";
import { DEMO_EVENT_CHANGED, getMode, getProfile, type DemoMode } from "@/lib/demo/store";
import { GLOSSARY, guideFor } from "@/lib/demo/guide/modules";
import { ANNOTATIONS, MAIN_TOUR, type TourStep } from "@/lib/demo/guide/tours";

const TOUR_KEY = "lc-demo:recorrido";
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
const readTour = () => safe(() => Number(sessionStorage.getItem(TOUR_KEY) ?? "-1"), -1);
const writeTour = (n: number) => safe(() => (n < 0 ? sessionStorage.removeItem(TOUR_KEY) : sessionStorage.setItem(TOUR_KEY, String(n))), undefined);
const GUIDE_EVENT = "lc-demo:ficha";
export const toggleGuide = () => window.dispatchEvent(new Event(GUIDE_EVENT));
export const startTour = () => { writeTour(0); window.dispatchEvent(new Event(DEMO_EVENT_CHANGED)); };

function useMode() {
  const [mode, setMode] = useState<DemoMode>("muestra");
  const [inside, setInside] = useState(false);
  useEffect(() => {
    const sync = () => { setMode(getMode()); setInside(getProfile() != null); };
    sync(); window.addEventListener(DEMO_EVENT_CHANGED, sync);
    return () => window.removeEventListener(DEMO_EVENT_CHANGED, sync);
  }, []);
  return { mode, inside };
}

/** Busca el elemento de un paso; la pantalla carga datos después de montar, así que reintenta un momento. */
function useTarget(selector: string | undefined, key: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    setRect(null);
    if (!selector) return;
    let alive = true, tries = 0;
    const find = () => {
      if (!alive) return;
      const el = selector.split(",").map(s => document.querySelector(s.trim())).find(Boolean) as HTMLElement | undefined;
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => alive && setRect(el.getBoundingClientRect()), 350); return; }
      if (tries++ < 25) setTimeout(find, 160);
    };
    find();
    const onResize = () => { const el = document.querySelector(selector.split(",")[0].trim()); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener("resize", onResize); window.addEventListener("scroll", onResize, true);
    return () => { alive = false; window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [selector, key]);
  return rect;
}

function TourOverlay() {
  const pathname = normalizePath(usePathname());
  const router = useRouter();
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const sync = () => setStep(readTour());
    sync(); window.addEventListener(DEMO_EVENT_CHANGED, sync);
    return () => window.removeEventListener(DEMO_EVENT_CHANGED, sync);
  }, []);
  const current: TourStep | null = step >= 0 ? MAIN_TOUR.steps[step] ?? null : null;
  const onRoute = current ? normalizePath(current.route) === pathname : false;
  const rect = useTarget(onRoute ? current?.selector : undefined, `${step}-${pathname}`);

  const go = useCallback((n: number) => {
    if (n < 0 || n >= MAIN_TOUR.steps.length) { writeTour(-1); setStep(-1); return; }
    writeTour(n); setStep(n);
    const target = MAIN_TOUR.steps[n].route;
    if (normalizePath(target) !== normalizePath(window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? "", ""))) router.push(target);
  }, [router]);

  useEffect(() => { if (current && !onRoute) router.push(current.route); }, [current, onRoute, router]);
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      // Las flechas no se roban dentro de un campo con texto; en uno vacío avanzan el recorrido.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("textarea,select") || (t instanceof HTMLInputElement && t.value)) return;
      if (e.key === "ArrowRight") go(step + 1); else if (e.key === "ArrowLeft") go(step - 1); else if (e.key === "Escape") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, step, go]);

  if (!current) return null;
  const pad = 8;
  const hl = rect && rect.width > 0 ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, window.innerHeight * 0.7) } : null;
  const below = hl ? hl.top + hl.height + 220 < window.innerHeight : true;
  const cardStyle: React.CSSProperties = hl && window.innerWidth > 640
    ? { top: below ? hl.top + hl.height + 12 : Math.max(12, hl.top - 232), left: Math.min(Math.max(16, hl.left), window.innerWidth - 400) }
    : {};
  return (
    <div className="os-theme demo-tour" role="dialog" aria-modal="false" aria-label={`Recorrido: ${current.title}`}>
      {hl ? <div className="demo-tour__hl" style={hl} /> : <div className="demo-tour__dim" />}
      <div className={`demo-tour__card${hl && window.innerWidth > 640 ? "" : " demo-tour__card--center"}`} style={cardStyle}>
        <div className="demo-tour__meta">Recorrido principal · {step + 1} de {MAIN_TOUR.steps.length}</div>
        <h2>{current.title.replace(/^\d+ · /, "")}</h2>
        <p>{current.text}</p>
        <div className="demo-tour__actions">
          <button type="button" className="btn btn-ghost" onClick={() => go(-1)}>Salir</button>
          <span>
            <button type="button" className="btn" disabled={step === 0} onClick={() => go(step - 1)}>Anterior</button>
            <button type="button" className="btn btn-primary" onClick={() => go(step + 1)} autoFocus>{step === MAIN_TOUR.steps.length - 1 ? "Terminar" : "Siguiente"}</button>
          </span>
        </div>
        <div className="demo-tour__keys">← → para avanzar · Esc para salir</div>
      </div>
    </div>
  );
}

function Annotations({ pathname }: { pathname: string }) {
  const list = useMemo(() => Object.entries(ANNOTATIONS).find(([k]) => pathname === k || pathname.startsWith(k + "/"))?.[1] ?? [], [pathname]);
  const [spots, setSpots] = useState<{ n: number; text: string; top: number; left: number }[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    setOpen(null);
    let alive = true, tries = 0;
    const place = () => {
      if (!alive) return;
      const found = list.map((a, i) => { const el = document.querySelector(a.selector); if (!el) return null; const r = el.getBoundingClientRect(); return { n: i + 1, text: a.text, top: r.top + window.scrollY - 10, left: Math.min(r.right + window.scrollX - 10, document.documentElement.clientWidth - 30) }; }).filter(Boolean) as { n: number; text: string; top: number; left: number }[];
      setSpots(found);
      if (found.length < list.length && tries++ < 20) setTimeout(place, 200);
    };
    place();
    const re = () => place();
    window.addEventListener("resize", re);
    return () => { alive = false; window.removeEventListener("resize", re); };
  }, [list]);
  return <>{spots.map(s => (
    <span key={s.n} className="demo-note" style={{ top: s.top, left: s.left }}>
      <button type="button" className="demo-note__dot" aria-expanded={open === s.n} aria-label={`Nota ${s.n}`} onClick={() => setOpen(open === s.n ? null : s.n)}>{s.n}</button>
      {open === s.n && <span className="demo-note__pop" role="note">{s.text}</span>}
    </span>
  ))}</>;
}

/** Botón «¿Para qué sirve?», ficha del módulo y, en modo prototipo, anotaciones y recorrido. */
export function DemoGuide() {
  const pathname = normalizePath(usePathname());
  const { mode, inside } = useMode();
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(false);
  const wasProto = useRef(false);
  useEffect(() => {
    // En modo prototipo la ficha queda abierta en pantallas anchas.
    if (mode === "prototipo" && !wasProto.current && window.innerWidth >= 1200) setOpen(true);
    wasProto.current = mode === "prototipo";
  }, [mode]);
  useEffect(() => { if (window.innerWidth < 1200) setOpen(false); }, [pathname]);
  useEffect(() => {
    const t = () => setOpen(o => !o);
    window.addEventListener(GUIDE_EVENT, t);
    return () => window.removeEventListener(GUIDE_EVENT, t);
  }, []);

  const bare = isDemoBarePath(pathname) || pathname.startsWith("/print/");
  return (
    <>
      <TourOverlay />
      {!bare && inside && mode === "prototipo" && <Annotations pathname={pathname} />}
      {!bare && inside && guide && (
        <>
          {open && (
            <aside id="demo-help" className="os-theme demo-help" aria-label={`Ficha: ${guide.title}`}>
              <div className="demo-help__head">
                <span className={`demo-status demo-status--${guide.status === "Proyecto" ? "proj" : guide.status === "En uso diario" ? "daily" : "use"}`}>{guide.status}</span>
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="Cerrar ficha">×</button>
              </div>
              <h2>{guide.title}</h2>
              <p>{guide.what}</p>
              <h3>Quién lo usa</h3><p>{guide.who}</p>
              <h3>Qué resuelve</h3><p>{guide.problem}</p>
              <h3>Reglas que aplica</h3><ul>{guide.rules.map(r => <li key={r}>{r}</li>)}</ul>
              <h3>Para probar</h3><ul>{guide.tryIt.map(r => <li key={r}>{r}</li>)}</ul>
              {!!guide.terms?.length && <><h3>Términos</h3><p className="demo-help__terms">{guide.terms.map(t => { const g = GLOSSARY.find(x => x.id === t); return g ? <Link key={t} href={`/glosario/#${t}`}>{g.term}</Link> : null; })}</p></>}
              <div className="demo-help__foot">
                <button type="button" className="btn btn-primary" onClick={() => { setOpen(false); startTour(); }}>Recorrido guiado (5 min)</button>
                <Link className="btn" href="/proyectos/">Proyectos</Link>
              </div>
            </aside>
          )}
        </>
      )}
    </>
  );
}
