"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePath } from "@/lib/demo/paths";
import { DEMO_EVENT_CHANGED, DEMO_EVENT_UNAVAILABLE, getMode, getProfile, resetDemo, setMode, setProfile, type DemoMode, type DemoProfile } from "@/lib/demo/store";

const PROFILE_LABEL: Record<DemoProfile, string> = { OWNER: "Dueño", ADMIN: "Administración", RECEPTION: "Recepción", MECHANIC: "Mecánico" };

/** Banda fina de la muestra: aviso de datos ficticios, perfil, modo y «Reiniciar». */
export function DemoBar() {
  const pathname = normalizePath(usePathname());
  const router = useRouter();
  const [mode, setModeState] = useState<DemoMode>("muestra");
  const [profile, setProfileState] = useState<DemoProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const sync = () => { setModeState(getMode()); setProfileState(getProfile()); };
    sync();
    const onUnavailable = () => setNotice("Esta función está en la versión completa de Lubricenter OS.");
    window.addEventListener(DEMO_EVENT_CHANGED, sync);
    window.addEventListener(DEMO_EVENT_UNAVAILABLE, onUnavailable);
    return () => { window.removeEventListener(DEMO_EVENT_CHANGED, sync); window.removeEventListener(DEMO_EVENT_UNAVAILABLE, onUnavailable); };
  }, []);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(t); }, [notice]);

  if (pathname.startsWith("/print/")) return null;
  const inside = profile != null && !["/", "/login"].includes(pathname);

  function switchMode() {
    const next: DemoMode = mode === "muestra" ? "prototipo" : "muestra";
    setMode(next);
    window.location.reload();
  }

  return (
    <>
      <div className="demo-bar" role="region" aria-label="Versión de muestra">
        <span className="demo-bar__tag">Versión de muestra<span className="demo-wide"> · datos ficticios</span>{mode === "prototipo" ? " · prototipo" : ""}</span>
        <span className="demo-bar__actions">
          {inside && (
            <label className="demo-bar__profile">
              <span className="sr-only">Perfil</span>
              <select value={profile ?? "OWNER"} onChange={e => { setProfile(e.target.value as DemoProfile); router.replace("/inicio/"); }} aria-label="Cambiar de perfil">
                {(Object.keys(PROFILE_LABEL) as DemoProfile[]).filter(p => p !== "MECHANIC").map(p => <option key={p} value={p}>{PROFILE_LABEL[p]}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="demo-bar__btn" onClick={switchMode} aria-pressed={mode === "prototipo"}>{mode === "muestra" ? <>Modo<span className="demo-wide"> prototipo</span></> : <>Salir<span className="demo-wide"> del prototipo</span></>}</button>
          {confirmReset
            ? <span className="demo-bar__confirm">¿Volver a los datos iniciales?
                <button type="button" className="demo-bar__btn" onClick={() => { resetDemo(); setConfirmReset(false); window.location.reload(); }}>Sí, reiniciar</button>
                <button type="button" className="demo-bar__btn" onClick={() => setConfirmReset(false)}>No</button></span>
            : <button type="button" className="demo-bar__btn" onClick={() => setConfirmReset(true)}>Reiniciar<span className="demo-wide"> la muestra</span></button>}
          <Link className="demo-bar__btn demo-wide" href="/proyectos/">Proyectos</Link>
        </span>
      </div>
      {notice && (
        <div className="demo-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          <Link href="/proyectos/" onClick={() => setNotice(null)}>Ver proyectos</Link>
          <button type="button" aria-label="Cerrar" onClick={() => setNotice(null)}>×</button>
        </div>
      )}
    </>
  );
}
