"use client";

import { useEffect, useState } from "react";

// WhatsApp simulado: en la muestra ningún botón sale a WhatsApp. Se muestra el mensaje
// que saldría, tal como lo arma el sistema.
const EVENT = "lc-demo:whatsapp";

export function simulateWhatsapp(link: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: link }));
}

function parse(link: string) {
  const q = new URLSearchParams(link.split("?")[1] ?? "");
  const phone = q.get("phone");
  return { phone: phone ? `+${phone}` : null, text: q.get("text") };
}

export function WhatsappSheet() {
  const [msg, setMsg] = useState<{ phone: string | null; text: string | null } | null>(null);
  useEffect(() => {
    const onEvent = (e: Event) => setMsg(parse(String((e as CustomEvent).detail)));
    // Cualquier enlace #whatsapp de la app abre esta hoja en lugar de salir del sitio.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#whatsapp']") as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      setMsg(parse(a.getAttribute("href") ?? ""));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMsg(null); };
    window.addEventListener(EVENT, onEvent);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(EVENT, onEvent); document.removeEventListener("click", onClick, true); window.removeEventListener("keydown", onKey); };
  }, []);
  if (!msg) return null;
  return (
    <div className="os-theme overlay demo-wa" role="dialog" aria-modal="true" aria-label="Mensaje de WhatsApp (simulado)" onClick={e => { if (e.target === e.currentTarget) setMsg(null); }}>
      <div className="sheet stack">
        <div className="row-between"><h2 style={{ margin: 0 }}>Mensaje de WhatsApp</h2><button className="btn btn-ghost" onClick={() => setMsg(null)}>Cerrar</button></div>
        <p className="muted small">En la versión completa esto abre WhatsApp con el mensaje listo{msg.phone ? ` para ${msg.phone}` : ""}. En la muestra no se envía nada.</p>
        {msg.text ? <div className="demo-wa__bubble">{msg.text}</div> : <p className="muted">Se abriría el chat sin mensaje precargado.</p>}
        <button className="btn btn-primary" onClick={() => setMsg(null)}>Entendido</button>
      </div>
    </div>
  );
}
