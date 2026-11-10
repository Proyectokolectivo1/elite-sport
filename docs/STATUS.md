# Estado del proyecto

| Fase | Estado | Agente |
|---|---|---|
| F0 Setup | Completada (falta solo Vercel) | devops |
| F1 Datos | Completada | db-architect |
| F2 Diseño | Completada | ui-designer |
| F3 Admin | Completada (detalles por pulir tras prueba manual) | admin-dev |
| F4 Tienda | Código listo (falta probar compra con stock real) | storefront-dev |
| F5 Mayoristas | Completada (falta prueba manual en navegador con una cuenta real) | wholesaler-dev |
| F6 QA y lanzamiento | Completada en código (faltan pasos del dueño: ver docs/LANZAMIENTO.md) | qa-security, devops |

## Por confirmar con el cliente
- [x] Supabase: se usa el proyecto existente `bjvwzqbvufckzlesnxzm` (vacío). Vercel: lo crea el usuario (pendiente nombre del scope). Dominio: por definir.
- [x] Identidad: se propone (lujo fresco, muy deportivo).
- [x] Tallas: dama EU 34–40, caballero EU 38–45, niño EU 22–33 (confirmado). El color es variante (confirmado).
- [x] Pedido mayorista sin mínimo.

## Decisiones
- 2026-11-10: plan aprobado (`docs/PLAN.md`).
- 2026-11-10: nombres de tablas, columnas y funciones en español.

## Registro por fase
<!-- Cada agente añade: ### Fase X — fecha · Hecho · Pendiente · Decisiones -->

### F0 — 2026-11-10
- **Hecho:** git init; Vite + React 18 + TS estricto; Tailwind v4; shadcn (Button); Router, TanStack Query, Zustand, RHF + Zod, Framer Motion; ESLint, Prettier, Vitest (1 test); `src/lib/supabase.ts`; `.env.example` y `.env.local` (clave publicable); `vercel.json` (rewrite SPA). `npm run build`, `lint` y `test` pasan.
- **Pendiente:** crear el proyecto en Vercel (el usuario crea `elite-sport` y da el scope) y deploy inicial. Playwright está instalado pero sin configurar (F6).
- **Decisiones:** alias `@/` → `src/`; `shadcn` en estilo base-nova (F2 lo reajusta a la identidad); fuentes Barlow Condensed + Inter por Google Fonts.

### F1 — 2026-11-10
- **Hecho:** 3 migraciones aplicadas en Supabase y guardadas en `supabase/migrations/` (esquema, funciones y RLS, storage y semillas). 20 tablas con RLS. Funciones: `registrar_ingreso_inventario`, `crear_pedido`, `confirmar_pedido`, `cancelar_pedido`, `entregar_pedido`, `ajustar_stock`, `obtener_precio_mayorista`. Buckets `productos` y `tiendas`. Semillas: tallas (dama 34–40, caballero 38–45, niño 22–33), 2 surtidos de caja, tienda principal, 5 productos de demostración con precio mayorista. Tipos en `src/types/database.ts` y cliente tipado.
- **Verificado (prueba con rollback, sin datos residuales):** 2 cajas dama (35×3, 37×3, 38×3, 39×3) = 6 pares por talla y 24 en total; venta pública confirmada baja el stock; pedido mayorista de 2 pares a 52.43 = 104.86; lead de tienda no toca el stock y no se puede confirmar; cancelar un pedido confirmado repone el stock; el UPDATE directo de stock, la escalada de rol y el ingreso de inventario por un mayorista quedan bloqueados.
- **Advisors:** seguridad sin errores; solo avisos esperados (funciones RPC ejecutables por diseño, `crear_pedido` también por anon). Rendimiento: solo índices sin uso (tablas vacías).
- **Decisiones:** el precio mayorista está en `precios_mayorista` (no en `productos`) para que el público nunca lo lea. El stock solo cambia por función (bandera de sesión). Los pedidos se crean únicamente con `crear_pedido`, que calcula los precios en el servidor.
- **Pendiente:** crear el usuario admin: registrarse en Auth y luego ejecutar `update perfiles set rol='admin', estado='aprobado' where id='<uuid>'` (F3 lo guía). Los productos de demostración se borran antes del lanzamiento. Limitación de abuso en `crear_pedido` (rate limit) a revisar en F6.

### F2 — 2026-11-10
- **Hecho:** identidad "lujo fresco + deportivo": tinta casi negra, hueso cálido y acento lima `#C8FF2E`; títulos en Barlow Condensed en mayúsculas, texto en Inter, esquinas casi rectas y líneas finas. `src/styles/tokens.css` (color claro/oscuro, estados, sombras, movimiento, gutter) enlazado desde `index.css`, con utilidades `container-page`, `eyebrow`, `display-xl/lg`. `src/lib/color.ts` (contraste WCAG, `buildBrandTokens`: texto legible sobre el primario y acento corregido a 3:1 si no se lee) y `ThemeProvider` (modo claro/oscuro persistido y `--brand-primary/--brand-accent` sobre `<html>`). `src/lib/money.ts` (`formatMoney`, `useFormatMoney`) alimentado por `features/configuracion` (query a `configuracion`). Componentes en `src/components/ui`: Button (default/solid/brand/outline/ghost/destructive/link), Input/Textarea/Select/Label, Badge, Skeleton, Table, EmptyState, Price, SizeSelector (disponible/pocas/agotada), ProductCard, Sheet (derecha, izquierda, inferior), Dialog y Toast. Layouts: `PublicLayout` (header con logo, búsqueda, carrito, saltar al contenido, footer) y `PanelLayout` (sidebar colapsable y barra inferior en móvil). Página `/_ds` con presets de tema y vista tienda/panel.
- **Verificado:** `build`, `lint` y `test` (10) pasan. Sin scroll horizontal en 375, 768 y 1280 px; el tema cambia con los presets y el acento ilegible se corrige solo; la hoja lateral abre. `prefers-reduced-motion` y foco visible cubiertos en base.
- **Decisiones:** el color primario de la tienda tiñe header, footer y superficies de marca; el acento va en botones principales. El Select es nativo estilizado (mejor teclado móvil). El `ThemeProvider` escribe las variables en `<html>` para que Sheet y Dialog (portales) hereden el tema.
- **Pendiente:** `/_ds` es ruta de desarrollo; ocultarla o protegerla antes del lanzamiento (F6). Sin fotos reales: la ficha usa una silueta neutra hasta que el admin suba imágenes (F3). Revisar con fotos reales el recorte 4:5 de la tarjeta (F4).

### F3 — 2026-11-10
- **Hecho:** panel `/admin` con guard de rol (`RequireAdmin`, login en `/admin/login`, `AuthProvider`). Pantallas: Resumen (pedidos nuevos, mayoristas por aprobar, stock bajo, agotadas), Productos (lista con filtros, formulario con marca/categoría/estilo y alta rápida, precios PVP y mayorista, subida múltiple de fotos por color con compresión a WebP y orden, tabla de tallas y stock en solo lectura), Inventario (existencias con ajuste y nota obligatoria, ingreso por caja o unidad con surtido y total editable por talla, movimientos con filtros, surtidos de caja), Precios (base y precio especial por mayorista, fijo o %), Pedidos (filtros, detalle, confirmar, entregar, cancelar por RPC), Mayoristas (aprobar, rechazar, suspender) y Configuración (moneda con vista previa, negocio y WhatsApp). Cada módulo sigue `features/<modulo>/{api,hooks,components}`; todo el acceso a datos va por TanStack Query y el stock solo por RPC.
- **Verificado:** `tsc`, `lint`, `build` y 16 tests pasan (incluye el cálculo de cajas: 2 cajas de 3 pares en 35 y 37 dan 6 y 6). Los `select` con relaciones se probaron contra la API real (sin errores) y el guard redirige a `/admin/login` en 375 y 1280 px.
- **No verificado:** el recorrido completo con sesión de admin (subir fotos, ingresar una caja desde la pantalla, confirmar un pedido) porque aún no existe el usuario admin. Las RPC ya se probaron en F1.
- **Decisiones:** el orden de las fotos se cambia con flechas (no arrastrando). El grupo de tallas de un producto no se edita tras crearlo. El ajuste de stock exige nota.
- **Pendiente:** crear el usuario admin (Auth → Add user, luego `update perfiles set rol='admin', estado='aprobado' where id='<uuid>'`) y hacer el recorrido completo; borrar productos de demostración antes del lanzamiento. No hay recuperación de contraseña ni creación de más admins (fuera de alcance).

### F4 — 2026-11-10
- **Hecho:** tienda pública en `/` y secciones de mayorista en `/t/:slug` con el mismo código (`StoreProvider` resuelve tienda, tema, WhatsApp y precio: el de `precios_tienda` o el PVP). Inicio (hero, grupos, destacados con grilla asimétrica, marcas, novedades), catálogo (filtros por grupo, talla con stock, marca, estilo, categoría y precio guardados en la URL; orden; carga progresiva; hoja inferior de filtros en móvil), ficha (galería por color, selector de talla con stock, relacionados) y carrito en hoja lateral (Zustand persistido, un carrito por tienda). Al enviar se llama a `crear_pedido` (`minorista` en la principal, `lead_tienda` en `/t/slug`, precios calculados en el servidor) y se abre `wa.me` con la plantilla de la tienda, el detalle y el total. SEO básico con `usePageMeta`. Nunca se consulta el precio mayorista.
- **Verificado:** `tsc`, `lint`, `build` y 26 tests pasan (filtros, carrito, mensaje de WhatsApp). En el navegador: inicio, catálogo con filtros, ficha y hoja de filtros sin scroll horizontal en 375 y 1280 px.
- **No verificado:** compra completa (agregar talla, enviar, abrir WhatsApp) porque aún no hay stock ni fotos cargados; se prueba tras ingresar mercancía desde el panel. La animación final de la hoja del carrito en móvil no se vio asentada. Lighthouse queda para F6.
- **Pendiente:** sin límite de abuso en `crear_pedido` (F6). Metadatos Open Graph por tienda (F6). Si `/t/slug` no existe, se muestra "tienda no disponible".

### F5 — 2026-11-10
- **Hecho:** `/registro` (datos personales y del negocio, cédula/RUC, WhatsApp; crea la cuenta y un trigger deja el perfil en *pendiente*), `/ingresar`, `/cuenta` (estado pendiente, rechazado o suspendido; redirige a `/mayorista` o `/admin` según el perfil) y guard `RequireMayorista`. Panel `/mayorista`: **Pedir** (catálogo con tu costo y PVP, cantidades por talla y color, pedido sin mínimo que llama a `crear_pedido` tipo `mayorista`, aviso opcional por WhatsApp al admin), **Mi sección** (logo y banner a `tiendas/{id}/`, colores con contraste corregido automáticamente, WhatsApp, saludo, enlace, vista previa en vivo), **Precios** (PVP, costo, precio propio, margen; margen % masivo; guardar en lote), **Pedidos** (mis compras al admin, cancelar si está nuevo, y leads de mi tienda) y **Compartir** (enlace, copiar y QR descargable).
- **Seguridad (migración 0004):** un mayorista suspendido podía reactivar su propia tienda con un UPDATE. `proteger_tienda` ahora bloquea que un no-admin cambie `activa`.
- **Verificado (prueba SQL con rollback, sin datos residuales):** perfil nace pendiente y sin tienda; pendiente no ve precios mayoristas; al aprobar se crea la tienda; el aprobado ve los precios y fija los suyos; no puede crear productos; pedido mayorista de 2 pares = 125.86 (62.93 c/u); confirmarlo baja el stock de 6 a 4; un lead de `lead_tienda` a 120.00 no cambia el stock; al suspender la tienda se desactiva y no puede reactivarla. También: `tsc`, `lint`, `build` y 33 tests; los guards redirigen y el formulario de registro valida en 375 px.
- **No verificado:** el recorrido completo con navegador y cuenta real (registro, aprobación, subir logo, cargar precios, pedido). Si Supabase exige confirmar el correo, el registro muestra "Confirma tu correo".
- **Pendiente:** activar "Leaked password protection" en Supabase Auth (ajuste del panel, no por migración). Evaluar si los mayoristas deben poder cambiar su contraseña desde el panel (hoy solo hay ingreso). Rate limit y SEO por tienda en F6.

### F6 — 2026-11-10
- **Seguridad:** migración 0005: `crear_pedido` ahora limita pedidos públicos a 15 por hora por IP y 6 por hora por teléfono (tabla `intentos_pedido` con RLS y sin políticas); los pedidos de mayoristas autenticados no pasan por el límite. Antes: 0004 impide que un mayorista suspendido reactive su tienda. Cabeceras en `vercel.json`: CSP estricta (solo el propio sitio y Supabase), HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer y Permissions Policy. Fuentes autoalojadas (sin Google Fonts). Las claves del cliente son solo la anon; las subidas están acotadas por tipo y peso en los buckets.
- **Pruebas de roles (`supabase/tests/rls_por_rol.sql`, se revierte sola):** anónimo, mayorista pendiente, aprobado y admin. Resultado: el anónimo y el pendiente no ven precios mayoristas; nadie crea ni edita productos salvo el admin; un mayorista no toca precios ni tiendas ajenas, no ajusta stock ni ingresa inventario, no cambia `activa` y no ve pedidos de otros; ni el admin puede hacer UPDATE directo de stock; confirmar baja el stock 10 → 9; el pedido 7 del mismo teléfono se rechaza. Hallazgo menor: `intentos_pedido` devuelve 0 filas al anónimo (RLS), no un error; es el comportamiento esperado.
- **Playwright (`npm run e2e`, Chrome instalado, 375 y 1280 px):** 34 pruebas pasan, 4 se omiten (recorrido del admin: necesita `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`). Cubren: inicio y filtros en la URL, el público nunca consulta el precio mayorista, tienda inexistente, sin scroll horizontal, rutas protegidas, `/_ds` fuera de producción, validación de registro e ingreso, carrito con pedido simulado y mensaje de WhatsApp (número, detalle y total), y axe sin violaciones serias en 5 pantallas.
- **Rendimiento (Lighthouse móvil, build servido con compresión):** Inicio 90, Catálogo 90 y Ficha 90; accesibilidad, buenas prácticas y SEO 100 en las tres. Se logró con: tienda pública en el paquete principal, carrito cargado al abrirlo, portada pintada sin esperar la red, esqueletos que evitan saltos (CLS ≈ 0) y fuentes propias. Es el mínimo exigido; el margen es corto.
- **SEO:** `robots.txt`, `favicon.svg`, metadatos base; `api/sitemap.ts` genera `sitemap.xml` (probado: lista productos) y `api/tienda.ts` inyecta título, descripción e imagen Open Graph por tienda en `/t/:slug` (rewrite en `vercel.json`).
- **No verificado:** las funciones de Vercel (`api/*`) y los rewrites solo corren en Vercel; `sitemap` se probó en local, `tienda.ts` solo compila. El recorrido de admin de Playwright no se ejecutó (sin credenciales). Falta un Lighthouse sobre producción real con dominio.
- **Pendiente (dueño):** ver `docs/LANZAMIENTO.md` (Vercel, dominio, ajustes de Supabase Auth, borrar productos de demostración, prueba manual). Imagen Open Graph por defecto de la tienda principal.
