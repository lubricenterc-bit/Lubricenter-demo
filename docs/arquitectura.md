# Arquitectura de la versión de muestra

1. **Enfoque:** se reutilizan las pantallas reales de Lubricenter OS (commit de origen en el README) y se reemplaza solo la capa de datos. La muestra es un sitio estático (`next build` con `output: "export"`) servido por GitHub Pages bajo `/Lubricenter-demo`, sin servidor, sin base de datos y sin red en tiempo de ejecución.
2. **Carpetas propias de la muestra:**
   - `lib/demo/client.ts`: cliente con la misma interfaz que usan las pantallas (`rpc`, `from().select/eq/order/…`, `auth`).
   - `lib/demo/rpc/<nombre>.ts`: un manejador por RPC, con la regla de negocio portada del SQL.
   - `lib/demo/tables.ts`: tablas que se leen con `from()`.
   - `lib/demo/rules/`: reglas puras con pruebas (vitest).
   - `lib/demo/seed/`: semilla generada por `scripts/generate-seed.ts` con semilla fija y fechas relativas a hoy (America/Caracas).
   - `components/demo/`: banda de la muestra, modo prototipo, paneles «¿Para qué sirve?» y la pantalla de módulo no disponible.
3. **Llamadas sin manejador:** el cliente responde un error `DEMO_NO_DISPONIBLE` (las pantallas ya muestran `error.message`) y además abre un aviso global «Esta función está en la versión completa» con enlace a Proyectos. Un `app/error.tsx` atrapa cualquier error de render. Nunca hay una pantalla en blanco.
4. **Cobertura:** `scripts/demo-coverage.ts` sigue las importaciones desde cada página visible y compara cada `.rpc()` y `.from()` con los manejadores. En CI corre en modo informe hasta F3 y en modo estricto desde F3.
5. **Rutas con ID:** cada `[id]` es una página de servidor mínima con `generateStaticParams` que envuelve la vista cliente original (`view.tsx`). Los IDs son los de la semilla más una **reserva** de IDs (`ord-n001…`) que el cliente asigna a lo que se crea durante la visita; así toda URL abre al recargar, sin respaldo `?id=`.
6. **Módulos fuera de la muestra:** su `page.tsx` muestra `FullVersionOnly` (qué es y enlace a Proyectos). El código que ya no usa ninguna página se elimina.
7. **Rutas de la muestra:** `/` portada, `/login` entrada a la muestra con selector de perfil, `/inicio` es el Inicio del sistema, `/proyectos`, `/glosario`, `/como-esta-construido`. Estas se ven sin el menú del sistema.
8. **Estado:** la semilla se copia en memoria al entrar; los cambios se guardan en `localStorage` (`lc-demo:v1`, con try/catch). «Reiniciar la muestra» borra la clave. Si cambia la versión de la semilla, se reinicia sola. En modo prototipo nada se guarda.
9. **Perfiles:** sin login real. Selector Dueño / Administración / Recepción / Mecánico que aplica `staff_can` portado.
10. **Textos y datos:** la sede se llama «Centro», las otras «Sede 2» y «Sede 3»; el personal se nombra por su rol; las facturas usan `DEMO-`, `S2-` y `S3-`; WhatsApp se simula.
