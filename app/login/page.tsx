"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginReturnPath } from "@/lib/login-return";
import { BrandIcon, Gotin, useLive } from "@/components/gotin";
import { asset } from "@/lib/demo/asset";
import { getMode, setMode, setProfile, type DemoProfile } from "@/lib/demo/store";

// Entrada a la versión de muestra: no hay usuarios ni contraseñas; se elige un perfil
// y la app aplica los mismos permisos que el sistema real.
const PROFILES: { id: DemoProfile; title: string; note: string }[] = [
  { id: "OWNER", title: "Dueño", note: "Ve todo: ventas, cobros, inventario, ganancias y configuración." },
  { id: "ADMIN", title: "Administración", note: "Opera la caja y los cobros. Los módulos del dueño piden PIN." },
  { id: "RECEPTION", title: "Recepción", note: "Recibe vehículos, crea órdenes y hace el seguimiento. No cobra." },
];

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<DemoProfile | null>(null);
  const artLive = useLive<HTMLElement>();

  function enter(profile: DemoProfile) {
    setBusy(profile);
    const params = new URLSearchParams(window.location.search);
    if (params.get("modo") === "prototipo" && getMode() !== "prototipo") setMode("prototipo");
    setProfile(profile);
    router.replace(loginReturnPath(params.get("next")) === "/" ? "/inicio/" : loginReturnPath(params.get("next")));
  }

  return (
    <main className="os-theme os-login">
      <section className="os-login-art" ref={artLive} aria-label="Lubricenter OS">
        <span className="os-wordmark os-login-wordmark" role="img" aria-label="Lubricenter" />
        <div className="os-login-copy">
          <h1>Todo listo.<br />A trabajar.</h1>
          <p>El mostrador, el taller y tu equipo en una misma mesa.</p>
        </div>
        <div className="os-login-stage" aria-hidden="true">
          <Gotin pose="wave" jump={busy != null} />
          <span className="os-login-props"><BrandIcon name="bottle" /><BrandIcon name="filter" /><BrandIcon name="wrench" /></span>
        </div>
        <span className="os-login-foot">Versión de muestra · datos ficticios</span>
      </section>
      <section className="os-login-form">
        <div className="os-login-card">
          <div className="os-login-brand"><img src={asset("/lubricenter-lc-isotipo.png")} alt="" /><span>Lubricenter <b>OS</b></span></div>
          <h2>Entrar a la versión de muestra</h2>
          <p>Elige con qué perfil quieres verla. Puedes cambiarlo después desde el menú.</p>
          <div className="demo-profiles">
            {PROFILES.map(p => (
              <button key={p.id} type="button" className="demo-profile" disabled={busy != null} onClick={() => enter(p.id)}>
                <strong>{busy === p.id ? "Entrando…" : p.title}</strong>
                <span>{p.note}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Los datos son inventados. Lo que hagas se guarda solo en este navegador.</p>
        </div>
      </section>
    </main>
  );
}
