"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtRef, fmtVes } from "@/lib/format";
import { NumberInput } from "@/components/number-field";
import type { InventoryFullRow } from "@/lib/inventory-full";

export type InventoryRates = { bcv: number; operative: number };
export type InventoryLocation = { id: string; code: string; name: string };

type ItemForm = {
  id: string | null; sku: string; name: string; description: string; brand: string; category: string; unit: string;
  price: string; cost: string; image: string; codes: string; active: boolean; needsReview: boolean; inCatalog: boolean;
  quantity: string; originalQuantity: number; countNote: string; updatedAt: string | null;
};

const qtyText = (v: number) => v.toLocaleString("es-VE", { maximumFractionDigits: 2 });
const parseDecimal = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));

function formFrom(r: InventoryFullRow | null, defaultCategory: string): ItemForm {
  return r ? {
    id: r.id, sku: r.sku, name: r.display_name || r.description, description: r.description ?? "", brand: r.brand ?? "",
    category: r.category ?? "", unit: r.unit || "UND", price: r.price_usd != null ? String(r.price_usd) : "",
    cost: r.average_cost_ref != null ? String(Number(r.average_cost_ref.toFixed(4))) : "", image: r.image_url ?? "",
    codes: r.alt_codes.join(", "), active: r.active, needsReview: r.needs_review, inCatalog: r.in_catalog,
    quantity: String(r.quantity_on_hand), originalQuantity: r.quantity_on_hand, countNote: "", updatedAt: r.updated_at,
  } : {
    id: null, sku: "", name: "", description: "", brand: "", category: defaultCategory, unit: "UND",
    price: "", cost: "", image: "", codes: "", active: true, needsReview: false, inCatalog: false,
    quantity: "0", originalQuantity: 0, countNote: "", updatedAt: null,
  };
}

/**
 * Hoja «Editar artículo» / «Nuevo artículo». La usan Inventario y Catálogo:
 * los dos guardan con inventory_save_item_full y el ajuste de existencia con
 * inventory_set_count_at_location, así que el resultado es el mismo.
 */
export function InventoryItemSheet({ row, defaultCategory = "", categories, location, rates, onClose, onSaved }: {
  row: InventoryFullRow | null;
  defaultCategory?: string;
  categories: string[];
  location: InventoryLocation | null;
  rates: InventoryRates;
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState<ItemForm>(() => formFrom(row, defaultCategory));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (busy) return;
    const price = parseDecimal(form.price);
    const cost = parseDecimal(form.cost);
    const quantity = parseDecimal(form.quantity);
    if (price != null && (!Number.isFinite(price) || price < 0)) return setError("El precio de venta debe ser un número válido.");
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) return setError("El costo debe ser un número válido.");
    if (quantity == null || !Number.isFinite(quantity) || quantity < 0) return setError("La existencia debe ser cero o mayor.");
    const quantityChanged = quantity !== form.originalQuantity;
    if (quantityChanged && !form.active) return setError("Para cambiar la existencia, el artículo debe estar activo.");
    if (quantityChanged && !form.countNote.trim()) return setError("Escribe el motivo del cambio de existencia (por ejemplo, «recuento del estante»).");
    if (quantityChanged && !location) return setError("No encontré la sede Centro.");
    if (form.inCatalog && !(price && price > 0)) return setError("Para mostrarlo en el catálogo ponle un precio de venta.");

    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.rpc("inventory_save_item_full", {
        p_id: form.id, p_sku: form.sku, p_display_name: form.name, p_description: form.description, p_brand: form.brand,
        p_category: form.category, p_unit: form.unit, p_price_usd: price, p_cost_ref: cost, p_image_url: form.image,
        p_alt_codes: form.codes.split(",").map(x => x.trim()).filter(Boolean),
        p_active: form.active, p_needs_review: form.needsReview, p_in_catalog: form.inCatalog && form.active,
        p_expected_updated_at: form.updatedAt,
      });
      if (error) throw error;
      const id = (data as { id?: string } | null)?.id ?? form.id;
      if (quantityChanged && id && location) {
        const { error: countError } = await supabase.rpc("inventory_set_count_at_location", {
          p_inventory_item_id: id, p_location_id: location.id, p_expected_quantity: form.originalQuantity,
          p_new_count: quantity, p_note: form.countNote.trim(),
        });
        if (countError) throw countError;
      }
      await onSaved(`${form.sku.toUpperCase()}: ${form.id ? "guardado" : "creado"}${quantityChanged ? `, existencia ${qtyText(quantity)}` : ""}.`);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const formPrice = parseDecimal(form.price);

  return <div className="overlay"><div className="sheet stack inv-sheet" role="dialog" aria-modal="true" aria-label={form.id ? "Editar artículo" : "Nuevo artículo"}>
    <div className="row-between"><h2 style={{ margin: 0 }}>{form.id ? "Editar artículo" : "Nuevo artículo"}</h2><button className="btn btn-ghost" onClick={onClose}>Cerrar</button></div>
    {error && <div className="error" role="alert">{error}</div>}

    <fieldset className="inv-group"><legend>Identificación</legend>
      <label><span className="label">Nombre de venta</span><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Filtro de aceite Wix 51061" autoFocus /></label>
      <div className="grid grid-2">
        <label><span className="label">Código (SKU)</span><input className="input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></label>
        <label><span className="label">Marca</span><input className="input" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
        <label><span className="label">Rubro</span><input className="input" list="inventory-categories" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></label>
        <label><span className="label">Unidad</span><input className="input" list="inventory-units" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></label>
      </div>
      <label><span className="label">Descripción interna</span><input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Como aparece en el conteo o la factura" /></label>
      <label><span className="label">Otros códigos (separados por coma)</span><input className="input" value={form.codes} onChange={e => setForm({ ...form, codes: e.target.value })} placeholder="Ej. CC006, Rav4" /></label>
      <datalist id="inventory-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="inventory-units"><option value="UND" /><option value="LT" /><option value="GAL" /><option value="KIT" /></datalist>
    </fieldset>

    <fieldset className="inv-group"><legend>Existencia</legend>
      <div className="grid grid-2">
        <label><span className="label">Cantidad en {location?.name ?? "Centro"}</span><NumberInput className="input" kind="qty" min="0" step="0.01" value={form.quantity} disabled={!form.active} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label>
        <div className="muted small inv-hint">Hoy el sistema tiene {qtyText(form.originalQuantity)}. Al cambiarla se guarda un ajuste con tu motivo en los movimientos.</div>
      </div>
      {parseDecimal(form.quantity) !== form.originalQuantity && <label><span className="label">Motivo del cambio</span><input className="input" value={form.countNote} onChange={e => setForm({ ...form, countNote: e.target.value })} placeholder="Ej. Recuento del estante" /></label>}
    </fieldset>

    <fieldset className="inv-group"><legend>Precio y costo</legend>
      <div className="grid grid-2">
        <label><span className="label">Precio de venta en divisas (USD)</span><input className="input" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Ej. 6.50" /></label>
        <label><span className="label">Costo unitario (REF)</span><input className="input" inputMode="decimal" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="Sin costo: se estima precio ÷ 1,35" /></label>
      </div>
      {formPrice != null && formPrice > 0 && rates.operative > 0 && rates.bcv > 0 && <div className="muted small">Se venderá aprox. a {fmtVes(formPrice * rates.operative)}, {fmtRef(formPrice * rates.operative / rates.bcv)}.</div>}
    </fieldset>

    <fieldset className="inv-group"><legend>Estado</legend>
      <label className="row"><input type="checkbox" checked={form.inCatalog} disabled={!form.active} onChange={e => setForm({ ...form, inCatalog: e.target.checked })} /> <span>Mostrar en el catálogo (necesita precio de venta)</span></label>
      <label className="row"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked, inCatalog: e.target.checked && form.inCatalog })} /> <span>Activo (desmárcalo para archivar un artículo que ya no se maneja)</span></label>
      <label className="row"><input type="checkbox" checked={form.needsReview} onChange={e => setForm({ ...form, needsReview: e.target.checked })} /> <span>Por revisar (no se puede vender hasta quitar la marca)</span></label>
      <label><span className="label">Foto (enlace https)</span><input className="input" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} /></label>
    </fieldset>

    <button className="btn btn-primary btn-block" disabled={busy || form.name.trim().length < 2 || form.sku.trim().length < 2} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button>
  </div></div>;
}
