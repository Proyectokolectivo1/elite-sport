# Elite Sport: plan maestro

> Fuente de verdad. Cada agente lee **solo** la sección de su fase y las reglas de negocio.

## 1. Producto
Catálogo y venta de zapatos para Elite Sport (Guayaquil). Hay un **inventario central único**, que pertenece al admin.

| Rol | Qué hace |
|---|---|
| Público | Compra a PVP en la tienda principal. |
| Mayorista (aprobado por el admin) | a) Pide al admin a precio mayorista. b) Tiene su sección `/t/{slug}`, que reutiliza el catálogo del admin con su logo, colores, WhatsApp y precios propios. |
| Admin | Gestiona el catálogo, las imágenes, el inventario, los precios, las aprobaciones y los pedidos. |

## 2. Reglas de negocio
| Flujo | Precio | ¿Descuenta stock? |
|---|---|---|
| Público → tienda principal → WhatsApp del admin | PVP | Sí, al confirmar el admin. |
| Mayorista → pedido mayorista → admin | Mayorista (o especial) | Sí, al confirmar el admin. |
| Cliente → `/t/{slug}` → WhatsApp del mayorista | El que fija el mayorista | **No** (es un `lead_tienda`). |

Reglas adicionales:
- El mayorista no tiene stock propio y no crea ni edita productos ni imágenes.
- Precio mayorista: lo define el admin por producto, y puede añadir un override (precio fijo o %) para un mayorista concreto.
- Precio en `/t/{slug}`: libre. Si el mayorista no lo fija, se usa el PVP.
- Ingreso de mercancía (solo el admin): por **caja** (surtido por talla × número de cajas = unidades por talla, editable antes de guardar, suma al inventario general) o por **unidad**.
- Pedido mayorista: **sin mínimo**.
- El público nunca ve el precio mayorista.
- Moneda: configuración global (ISO, símbolo, decimales, locale). Por defecto USD. Se formatea con `Intl.NumberFormat`.
- Identidad: lujo fresco y muy deportivo (la propone ui-designer en F2).
- Venta: carrito → pedido guardado → WhatsApp con el detalle. Sin pasarela de pago.
- Idioma: español.

## 3. Stack
React 18 + Vite + TS · Tailwind + shadcn/ui · React Router · TanStack Query · Zustand · RHF + Zod · Framer Motion · Supabase (Postgres, Auth, Storage, RLS, RPC) · Vitest + Playwright · Vercel.

## 4. Datos (Supabase)
**Convención:** todo en español (tablas, columnas, enums, funciones), en `snake_case` sin tildes.

**Usuarios y tiendas**
- `perfiles`: rol (admin | mayorista), estado (pendiente | aprobado | rechazado | suspendido), nombre, telefono, cedula_ruc, ciudad, negocio.
- `tiendas`: propietario_id, slug, nombre, logo_url, banner_url, color_primario, color_acento, whatsapp, plantilla_mensaje, activa.
- `configuracion`: fila única con moneda (codigo_iso, simbolo, decimales, locale) y datos del negocio.

**Catálogo**
- `marcas`, `categorias`, `estilos`.
- `tallas` (etiqueta, grupo: dama | caballero | nino, orden). Rangos: dama 34–40, caballero 38–45, niño 22–33.
- `productos` (precio_publico, precio_mayorista, activo, destacado).
- `imagenes_producto` (por color).
- `variantes_producto` (color, talla_id, sku, stock). El color es variante.

**Precios**
- `precios_especiales_mayorista`: definidos por el admin (precio fijo o %).
- `precios_tienda`: definidos por el mayorista.

**Inventario**
- `curvas_tallas` + `curvas_tallas_detalle`: surtido de caja (talla → pares por caja).
- `ingresos_inventario` (tipo: caja | unidad, num_cajas) + `ingresos_inventario_detalle` (variante_id, cantidad).
- `movimientos_inventario`: libro mayor.

**Pedidos**
- `pedidos` (tipo: minorista | mayorista | lead_tienda; estado: nuevo | confirmado | entregado | cancelado) + `pedidos_detalle`.

**Funciones RPC** (únicos puntos que tocan el stock):
- `registrar_ingreso_inventario`: **conversión de caja a unidades**. Pares por talla = pares de esa talla en el surtido × número de cajas. Es editable por talla antes de guardar y suma a `variantes_producto.stock`.
- `confirmar_pedido`
- `cancelar_pedido`
- `ajustar_stock`
- `obtener_precio_mayorista`

**RLS:**
- Lectura pública del catálogo activo, sin precio mayorista.
- Escritura de catálogo, inventario y precios: solo el admin.
- El mayorista solo accede a su `tienda`, sus `precios_tienda`, sus pedidos y sus leads.
- Storage: el bucket `productos` lo escribe el admin; en `tiendas/{tienda_id}/` escribe solo el dueño.

**Infraestructura:** proyecto Supabase `bjvwzqbvufckzlesnxzm` (org Elite Sport, us-east-1, vacío). Vercel: lo crea el usuario.

## 5. Diseño
- Estilo deportivo premium: display condensada (Barlow Condensed) con Inter para el texto.
- Base oscura y un acento de alto contraste.
- Grilla asimétrica y foto de producto protagonista.
- Sin emojis, degradados genéricos ni textos de relleno.
- Mobile-first, con bottom-sheets.
- Accesibilidad AA. Lighthouse móvil ≥ 90.
- El tema de cada tienda se aplica con variables CSS (`--brand-primary`, `--brand-accent`).

## 6. Fases
| Fase | Agente | Criterio de aceptación |
|---|---|---|
| F0 Setup | orchestrator → devops | Repo git, Vite + TS + Tailwind + shadcn, cliente Supabase, `.env.example`, deploy inicial en Vercel. |
| F1 Datos | db-architect | Migraciones, RLS y RPC aplicados; seeds (tallas, curvas, 5 productos); tipos TS generados; advisors limpios. |
| F2 Diseño | ui-designer | Tokens, tema dinámico, componentes base, layouts público/panel, página de muestra responsive. |
| F3 Admin | admin-dev | CRUD de catálogo con imágenes y precios; ingreso por caja/unidad; movimientos y ajustes; configuración de moneda. |
| F4 Tienda | storefront-dev | Home, catálogo con filtros, ficha con tallas, carrito → pedido → WhatsApp; el admin confirma y el stock baja. |
| F5 Mayoristas | wholesaler-dev | Registro → aprobación; pedido mayorista; sección `/t/slug` con su marca y precios; los leads no tocan el stock. |
| F6 QA y lanzamiento | qa-security → devops | E2E de los flujos críticos, RLS por rol, Lighthouse, dominio, SEO y OG por tienda. |

## 7. Prueba de punta a punta (F6)
1. Ingresar 2 cajas con la curva 35×3 y 37×3 → stock 6 y 6.
2. Venta al público de 1 par de la 35, confirmada → la 35 queda en 5.
3. Pedido mayorista de 2 pares de la 37, confirmado → la 37 queda en 4, a precio mayorista.
4. Pedido en `/t/slug` → WhatsApp del mayorista con su precio → el stock no cambia.
5. El público no ve el precio mayorista; un mayorista no edita productos ni los precios de otros.
