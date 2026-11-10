# Lanzamiento de Elite Sport

Lista de pasos que solo puede hacer el dueño de las cuentas. Marca cada uno al terminarlo.

## 1. Vercel
- [ ] Crear el proyecto `elite-sport` desde el repositorio (framework: Vite; build `npm run build`; salida `dist`).
- [ ] Variables de entorno (Production y Preview): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Son las mismas de `.env.local`. **No subas la clave `service_role`.**
- [ ] Primer deploy y revisar `/`, `/catalogo`, `/admin/login`, `/sitemap.xml` y `/t/<slug>` de un mayorista aprobado.
- [ ] Dominio propio: añadirlo en Vercel y apuntar el DNS.
- [ ] En `public/robots.txt` agregar la línea `Sitemap: https://TU-DOMINIO/sitemap.xml`.

## 2. Supabase (panel → Authentication)
- [ ] **URL Configuration:** Site URL = el dominio de producción; añadir también la URL de Vercel Preview a Redirect URLs.
- [ ] **Providers → Email:** decidir si se exige confirmar el correo al registrarse. Con confirmación, el registro muestra "Confirma tu correo".
- [ ] **Passwords:** activar *Leaked password protection* y subir el mínimo a 8 caracteres.
- [ ] **Rate limits:** revisar los límites de envío de correos de autenticación.
- [ ] Plan: el plan gratuito pausa el proyecto tras una semana sin uso; para producción conviene un plan de pago.

## 3. Datos
- [ ] Borrar los 5 productos de demostración (Productos → eliminar) antes de cargar el catálogo real.
- [ ] En Configuración: moneda, ciudad y WhatsApp principal del negocio.
- [ ] Cargar productos, fotos por color y precios; ingresar el inventario inicial por caja.
- [ ] En la tienda principal (`tiendas`, fila `es_principal`): logo, banner y colores si se desean distintos de los de marca.

## 4. Pruebas antes de abrir al público
- [ ] `npm run e2e` (usa Chrome instalado). Con credenciales reales: `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD` activan el recorrido del admin; `E2E_MUTATE=1` permite que registre una caja de prueba.
- [ ] Pruebas de roles en la base: ejecutar `supabase/tests/rls_por_rol.sql` en el SQL Editor (no deja datos).
- [ ] Recorrido manual: registrar un mayorista, aprobarlo, personalizar su sección, hacer un pedido a precio mayorista y confirmarlo; hacer un pedido público desde el teléfono.
