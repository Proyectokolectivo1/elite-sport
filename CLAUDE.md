# Elite Sport: guía del repo

Web de catálogo y venta de zapatos con inventario central y mayoristas con sección propia.

- Plan: `docs/PLAN.md` (lee solo tu fase y las secciones 2 y 4).
- Estado: `docs/STATUS.md`. Actualízalo al cerrar cada tarea.

## Flujo de trabajo
- Se trabaja por fases, con **un agente a la vez**.
- El `orchestrator` asigna la fase y valida sus criterios. Ningún agente empieza una fase sin que la anterior esté marcada como Completada.
- No amplíes el alcance: lo que esté fuera de la fase se anota como pendiente en STATUS.

## Convenciones
- **Lenguaje y tipos:** TypeScript estricto. Prohibido `any`. Los tipos de BD salen de `src/types/database.ts` (generado).
- **Estructura:**
  - `src/features/<modulo>/{components,hooks,api}` para los módulos.
  - `src/components/ui` para shadcn.
  - `src/lib` para el cliente Supabase, `formatMoney` y utilidades.
- **Datos:** TanStack Query para todo acceso a datos; nunca llames a Supabase desde un componente.
- **Formularios:** React Hook Form + Zod; los esquemas van en `schemas.ts` del módulo.
- **Idioma del esquema:** tablas, columnas, enums y funciones en español (ver PLAN sección 4).
- **Stock:** solo cambia mediante RPC (`registrar_ingreso_inventario`, `confirmar_pedido`, `cancelar_pedido`, `ajustar_stock`). Nunca hagas un UPDATE directo a `stock` (variantes_producto).
- **Precios:** siempre con `formatMoney()`, que lee `configuracion`. Nunca hardcodees `$`.
- **Precio mayorista:** jamás va en consultas públicas.
- **Migraciones:** en `supabase/migrations/` y numeradas. Toda tabla nueva lleva RLS habilitado y sus políticas.
- **UI:**
  - Usa los tokens de `src/styles/tokens.css`; no pongas colores sueltos.
  - Sin emojis ni lorem ipsum. Los textos van en español y con tono de marca.
  - Mobile-first. Revisa los anchos de 375, 768 y 1280 px.
- **Commits:** `tipo(fase): descripción`, por ejemplo `feat(F3): ingreso por caja`.

## Comandos (tras F0)
- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run e2e`
- `npm run db:types`
