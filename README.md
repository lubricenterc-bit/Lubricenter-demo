# Lubricenter OS · Versión de muestra

Publicada en https://lubricenterc-bit.github.io/Lubricenter-demo/ (cuando se active GitHub Pages).

Versión de demostración de Lubricenter OS que funciona sola en el navegador, con datos ficticios y sin conexión a ningún servicio.

- **Origen:** pantallas copiadas de `lubricenter-os` en el commit `90c57ff33895a4d19f46bd5eaf9a95fc42e240c5` (18 nov 2026). Sin su historial.
- **Arquitectura:** ver `docs/arquitectura.md`.

## Cómo correrla

```bash
npm ci
npm run dev        # http://localhost:3000/Lubricenter-demo
npm run build      # sitio estático en out/
```

Pruebas y cobertura:

```bash
npm run lint && npm test && npm run coverage:demo
```

## Cómo actualizarla cuando cambie el sistema

1. Copia los archivos de las pantallas desde un commit nuevo de `main` (solo `app/`, `components/`, `lib/`, `public/`; nunca `supabase/`, `scripts/`, `docs/`, `tests/`, `app/api/` ni el service worker).
2. Vuelve a aplicar los reemplazos de textos (sede, personal, prefijos) y corre `npm run coverage:demo` para ver qué RPC nuevas necesitan manejador.
3. Actualiza el commit de origen en este README.

## Regenerar la semilla

```bash
node scripts/generate-seed.ts
```
