// Enlace para «abrir WhatsApp» con el texto listo.
//
// Versión de muestra: nunca sale a WhatsApp. El enlace es interno (#whatsapp?…) y
// components/demo/whatsapp-sheet.tsx muestra el mensaje que saldría.
export function whatsappUrl(phone?: string | null, text?: string | null) {
  const params: string[] = [];
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits) params.push(`phone=${digits}`);
  if (text) {
    // Un emoji partido a la mitad haría fallar encodeURIComponent; se reemplaza en vez de romper el botón.
    const safe = text.normalize("NFC").replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
    params.push(`text=${encodeURIComponent(safe)}`);
  }
  return `#whatsapp${params.length ? `?${params.join("&")}` : ""}`;
}
