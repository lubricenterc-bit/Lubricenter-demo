"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Block, Project } from "@/lib/demo/guide/projects";

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "fields": return <dl className="proto-fields">{b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
    case "list": return <ul className="proto-list">{b.rows.map(r => <li key={r.title}><span><strong>{r.title}</strong>{r.note && <small>{r.note}</small>}</span>{r.pill && <em className={`proto-pill proto-pill--${r.tone ?? "plain"}`}>{r.pill}</em>}</li>)}</ul>;
    case "stages": return <div className="proto-stages">{b.columns.map(c => <div key={c.name}><h4>{c.name}</h4>{c.items.map(i => <span key={i}>{i}</span>)}</div>)}</div>;
    case "chat": return <div className="proto-chat">{b.lines.map((l, i) => <p key={i} className={`proto-chat__${l.from}`}>{l.text}</p>)}</div>;
    case "checklist": return <ul className="proto-check">{b.items.map(i => <li key={i.text} data-done={i.done}><span aria-hidden="true">{i.done ? "✓" : ""}</span>{i.text}</li>)}</ul>;
    case "total": return <div className="proto-total"><span>{b.label}</span><strong>{b.value}</strong>{b.note && <small>{b.note}</small>}</div>;
    case "text": return <p className="proto-text">{b.text}</p>;
  }
}

export function PrototypeView({ project }: { project: Project }) {
  const [i, setI] = useState(0);
  const s = project.screens[i];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "ArrowRight") setI(x => Math.min(project.screens.length - 1, x + 1)); if (e.key === "ArrowLeft") setI(x => Math.max(0, x - 1)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [project.screens.length]);
  return (
    <div className="os-theme demo-page">
      <div className="proto-banner" role="status">Prototipo · no funcional</div>
      <main className="demo-page__main">
        <Link className="btn btn-ghost" href="/proyectos/">← Volver a Proyectos</Link>
        <p className="demo-cover__eyebrow" style={{ marginTop: 18 }}>{project.status}</p>
        <h1>{project.title}</h1>
        <p className="demo-cover__lead">{project.problem}</p>
        <ol className="proto-steps" aria-label="Pantallas del prototipo">
          {project.screens.map((x, k) => <li key={x.title}><button type="button" aria-current={k === i ? "step" : undefined} onClick={() => setI(k)}>{k + 1}. {x.title}</button></li>)}
        </ol>
        <section className="proto-screen" aria-live="polite">
          <div className="proto-screen__head"><h2>{s.title}</h2><span>{s.caption}</span></div>
          {s.blocks.map((b, k) => <BlockView key={k} b={b} />)}
          <div className="proto-screen__foot">
            <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
            {i < project.screens.length - 1
              ? <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>{s.action ?? "Siguiente"}</button>
              : <Link className="btn btn-primary" href="/proyectos/">Ver otros proyectos</Link>}
          </div>
        </section>
        <p className="muted small" style={{ marginTop: 14 }}>Los botones del prototipo solo avanzan entre pantallas: no registran nada. Datos ficticios.</p>
      </main>
    </div>
  );
}
