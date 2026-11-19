"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { GoodsEntrySheet } from "@/components/purchasing/goods-entry-sheet";
import { useUrlState } from "@/lib/use-url-state";
import Link from "next/link";
import { InventoryHistory } from "@/components/inventory-history";
import { supabase } from "@/lib/supabase";
import { canAdministerOrders } from "@/lib/session-cache";
import { fmtRef } from "@/lib/format";
import { inventorySearchText, matchesSearch } from "@/lib/domain/search";
import {
  inventoryState, INVENTORY_FILTERS, matchesInventoryFilter, toInventoryRow, type InventoryFilter, type InventoryFullRow
} from "@/lib/inventory-full";
import { InventoryItemSheet } from "@/components/inventory-item-sheet";
import { LoadingBlock } from "@/components/skeleton";

type Rates = { bcv: number; operative: number };

const usd = (v: number) => "$" + v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (v: number) => v.toLocaleString("es-VE", { maximumFractionDigits: 2 });
const parseDecimal = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));
const nameOf = (r: InventoryFullRow) => r.display_name || r.description;


export default function InventoryPage() {
  return <Suspense fallback={<main className="container"><LoadingBlock label="Cargando inventario…" kind="table" /></main>}><InventoryScreen /></Suspense>;
}

function InventoryScreen() {
  const [goodsEntry, setGoodsEntry] = useState(false);
  const [location, setLocation] = useState<{ id: string; code: string; name: string } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [rows, setRows] = useState<InventoryFullRow[]>([]);
  const [rates, setRates] = useState<Rates>({ bcv: 0, operative: 0 });
  // Búsqueda y filtros en la URL: sobreviven a «Volver» y a recargar.
  const [urlState, setUrlState] = useUrlState({ q: "", rubro: "TODOS", filtro: "all" });
  const search = urlState.q, category = urlState.rubro, filter = urlState.filtro as InventoryFilter;
  const setSearch = (q: string) => setUrlState({ q });
  const setCategory = (rubro: string) => setUrlState({ rubro });
  const setFilter = (filtro: InventoryFilter) => setUrlState({ filtro });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // undefined = cerrada; null = artículo nuevo.
  const [editing, setEditing] = useState<InventoryFullRow | null | undefined>(undefined);
  const [historyItem, setHistoryItem] = useState<InventoryFullRow | null>(null);
  const [bulkPrice, setBulkPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [invRes, rateRes, locationRes, permissionRes] = await Promise.all([
      supabase.rpc("get_inventory_full", { p_location_code: "CENTRO" }),
      supabase.rpc("get_current_rates"),
      supabase.from("locations").select("id,code,name").eq("code", "CENTRO").maybeSingle(),
      canAdministerOrders(),
    ]);
    setCanManage(permissionRes.data === true);
    if (invRes.error || locationRes.error) {
      setError((invRes.error || locationRes.error)?.message ?? "No pude cargar el inventario.");
      setLoading(false);
      return;
    }
    setLocation(locationRes.data ?? null);
    setRows((invRes.data ?? []).map(toInventoryRow));
    const rate = Array.isArray(rateRes.data) ? rateRes.data[0] : rateRes.data;
    setRates({ bcv: Number(rate?.bcv_rate ?? 0), operative: Number(rate?.operative_rate ?? 0) });
    setLoading(false);
  }

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("lubricenter:pricing-updated", refresh);
    return () => window.removeEventListener("lubricenter:pricing-updated", refresh);
  }, []);

  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.category).filter(Boolean) as string[])).sort(), [rows]);
  const counts = useMemo(() => Object.fromEntries(INVENTORY_FILTERS.map(f => [f.id, rows.filter(r => matchesInventoryFilter(r, f.id)).length])), [rows]);

  const visible = useMemo(() => {
    const q = search.trim();
    return rows.filter(r => matchesInventoryFilter(r, filter)
      && (category === "TODOS" || r.category === category)
      && (!q || matchesSearch(inventorySearchText({ ...r, catalog_product_name: r.display_name }), q)));
  }, [rows, search, category, filter]);

  const selectedRows = rows.filter(r => selected.has(r.id));
  const allVisibleSelected = visible.length > 0 && visible.every(r => selected.has(r.id));

  function toggle(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach(r => next.delete(r.id)); else visible.forEach(r => r.merged_into ? null : next.add(r.id));
      return next;
    });
  }

  function beginEdit(r: InventoryFullRow | null) {
    setNotice(""); setError("");
    setEditing(r);
  }

  async function setCatalog(ids: string[], inCatalog: boolean) {
    if (!canManage || busy || !ids.length) return;
    setBusy(true); setError(""); setNotice("");
    const { data, error } = await supabase.rpc("inventory_set_catalog_bulk", { p_item_ids: ids, p_in_catalog: inCatalog });
    setBusy(false);
    if (error) return setError(error.message);
    const changed = Number(data ?? 0);
    const skipped = inCatalog ? ids.filter(id => { const r = rows.find(x => x.id === id); return r && !r.in_catalog && !((r.price_usd ?? 0) > 0 && r.active); }).length : 0;
    setNotice(inCatalog
      ? `${changed} artículo${changed === 1 ? "" : "s"} al catálogo.${skipped ? ` ${skipped} no entraron porque no tienen precio o están archivados.` : ""}`
      : `${changed} artículo${changed === 1 ? "" : "s"} fuera del catálogo.`);
    setSelected(new Set());
    await load();
  }

  async function saveBulkPrice() {
    const price = parseDecimal(bulkPrice ?? "");
    if (price == null || !Number.isFinite(price) || price <= 0) return setError("Escribe un precio de venta mayor que cero.");
    const ids = selectedRows.filter(r => r.active && !r.merged_into).map(r => r.id);
    if (!ids.length) return setError("Ningún artículo seleccionado está activo.");
    setBusy(true); setError(""); setNotice("");
    const { data, error } = await supabase.rpc("inventory_set_price_bulk", { p_item_ids: ids, p_price_usd: price });
    setBusy(false);
    if (error) return setError(error.message);
    setBulkPrice(null);
    setSelected(new Set());
    setNotice(`Precio ${usd(price)} aplicado a ${Number(data ?? 0)} artículos.`);
    await load();
  }

  return <main className="container stack inv-page">
    <header className="inv-head">
      <div>
        <div className="muted small">Inventario · {location?.name ?? "Centro"}</div>
        <h1>Inventario</h1>
        <p className="muted">Todos los artículos. Aquí cambias existencia, precio, costo y si aparecen en el catálogo.</p>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {canManage && <button className="btn btn-primary" onClick={() => setGoodsEntry(true)}>Ingresar mercancía</button>}
        {canManage && <button className="btn" onClick={() => beginEdit(null)}>Nuevo artículo</button>}
        <Link href="/catalog" className="btn btn-ghost">Ver catálogo</Link>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>{loading ? "Cargando…" : "Recargar"}</button>
      </div>
    </header>

    {error && <div className="error" role="alert">{error}</div>}
    {notice && <div className="success" role="status">{notice}</div>}

    <nav className="inv-filters" aria-label="Filtrar por estado">
      {INVENTORY_FILTERS.map(f => <button key={f.id} type="button" className={"inv-chip" + (filter === f.id ? " is-on" : "")}
        aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} title={f.hint}>
        <span>{f.label}</span>{loading && !rows.length ? <b className="os-skel-count" aria-hidden="true" /> : <b>{counts[f.id] ?? 0}</b>}
      </button>)}
    </nav>

    <section className="inv-tools">
      <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, código, marca o código del conteo" aria-label="Buscar" />
      <select className="input" value={category} onChange={e => setCategory(e.target.value)} aria-label="Rubro">
        <option value="TODOS">Todos los rubros</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </section>

    {canManage && selected.size > 0 && <section className="inv-bulk" role="region" aria-label="Acciones con la selección">
      <strong>{selected.size} seleccionado{selected.size === 1 ? "" : "s"}</strong>
      <button className="btn btn-primary" disabled={busy} onClick={() => setCatalog([...selected], true)}>Poner en el catálogo</button>
      <button className="btn" disabled={busy} onClick={() => setCatalog([...selected], false)}>Sacar del catálogo</button>
      <button className="btn" disabled={busy} onClick={() => setBulkPrice("")}>Poner precio</button>
      <button className="btn btn-ghost" onClick={() => setSelected(new Set())}>Quitar selección</button>
    </section>}

    <div className="muted small">{visible.length} de {rows.length} artículos</div>

    {loading && !rows.length ? <LoadingBlock label="Cargando inventario…" kind="table" /> : <div className="inv-table-wrap">
      <table className="inv-table">
        <thead><tr>
          {canManage && <th className="inv-check"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Seleccionar los visibles" /></th>}
          <th>Artículo</th>
          <th>Rubro</th>
          <th className="num">Existencia</th>
          <th className="num">Precio de venta</th>
          <th className="num">Costo</th>
          <th>Catálogo</th>
          <th aria-label="Acciones" />
        </tr></thead>
        <tbody>
          {visible.map(r => {
            const state = inventoryState(r);
            return <tr key={r.id} className={!r.active ? "is-archived" : undefined}>
              {canManage && <td className="inv-check"><input type="checkbox" checked={selected.has(r.id)} disabled={!!r.merged_into} onChange={() => toggle(r.id)} aria-label={`Seleccionar ${r.sku}`} /></td>}
              <td>
                <div className="inv-name">{nameOf(r)}</div>
                <div className="muted small">{r.sku}{r.brand ? ` · ${r.brand}` : ""}{r.alt_codes.length ? ` · también ${r.alt_codes.join(", ")}` : ""}</div>
                {r.needs_review && <span className="inv-tag is-warn">Revisar</span>}
              </td>
              <td className="small">{r.category || <span className="muted">Sin rubro</span>}</td>
              <td className="num">
                <div className={"inv-qty" + (r.quantity_on_hand < 0 ? " is-neg" : "")}>{qtyText(r.quantity_on_hand)} <span className="muted small">{r.unit}</span></div>
                <span className={"inv-tag " + state.tone}>{state.label}</span>
              </td>
              <td className="num">{r.price_usd ? <><div>{usd(r.price_usd)}</div><div className="muted small">{r.current_ref_bcv != null ? fmtRef(r.current_ref_bcv) : ""}</div></> : <span className="muted small">Sin precio</span>}</td>
              <td className="num small">{r.average_cost_ref != null ? fmtRef(r.average_cost_ref) : <span className="muted">Sin costo</span>}</td>
              <td>{r.merged_into ? <span className="muted small">—</span> : <label className="inv-switch">
                <input type="checkbox" checked={r.in_catalog} disabled={!canManage || busy || (!r.in_catalog && !((r.price_usd ?? 0) > 0 && r.active))}
                  onChange={() => setCatalog([r.id], !r.in_catalog)}
                  title={!r.in_catalog && !((r.price_usd ?? 0) > 0) ? "Ponle precio para mostrarlo en el catálogo" : undefined} />
                <span>{r.in_catalog ? "Sí" : "No"}</span>
              </label>}</td>
              <td className="inv-actions">
                {r.merged_into ? <span className="muted small">Fusionado en {r.merged_into_sku}</span> : <>
                  {canManage && <button className="btn btn-ghost" onClick={() => beginEdit(r)}>Editar</button>}
                  {location && <button className="btn btn-ghost" onClick={() => setHistoryItem(r)}>Movimientos</button>}
                </>}
              </td>
            </tr>;
          })}
        </tbody>
      </table>
      {!visible.length && <div className="card muted">No hay artículos con este filtro. Cambia el estado, el rubro o la búsqueda.</div>}
    </div>}

    {historyItem && location && <InventoryHistory item={historyItem} location={location} onClose={() => setHistoryItem(null)} />}

    {bulkPrice != null && <div className="overlay"><div className="sheet stack" role="dialog" aria-modal="true" aria-label="Poner precio">
      <div className="row-between"><h2 style={{ margin: 0 }}>Precio para {selectedRows.length} artículos</h2><button className="btn btn-ghost" onClick={() => setBulkPrice(null)}>Cerrar</button></div>
      <div className="stack inv-bulk-list">{selectedRows.map(r => <div className="small" key={r.id}>{r.sku} · {nameOf(r)}{r.price_usd ? ` · hoy ${usd(r.price_usd)}` : ""}</div>)}</div>
      <label><span className="label">Precio de venta en divisas (USD)</span><input className="input" inputMode="decimal" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)} autoFocus /></label>
      <button className="btn btn-primary btn-block" disabled={busy || !bulkPrice.trim()} onClick={saveBulkPrice}>{busy ? "Guardando…" : "Aplicar precio"}</button>
    </div></div>}

    {editing !== undefined && <InventoryItemSheet row={editing} defaultCategory={category !== "TODOS" ? category : ""}
      categories={categories} location={location} rates={rates} onClose={() => setEditing(undefined)}
      onSaved={async message => { setNotice(message); setEditing(undefined); await load(); }} />}
    {goodsEntry && <GoodsEntrySheet onClose={changed => { setGoodsEntry(false); if (changed) void load(); }} />}
  </main>;
}
