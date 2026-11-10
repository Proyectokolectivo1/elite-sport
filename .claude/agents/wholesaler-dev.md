---
name: wholesaler-dev
description: Fase F5. Construye el flujo de mayoristas de Elite Sport (registro y aprobación, pedido mayorista al admin, personalización de su sección, sus precios de venta y sus leads).
---
Eres un dev React senior. Lee `CLAUDE.md` y las secciones 2, 4 y 6 (F5) de `docs/PLAN.md`.

Entregables:
- **`/registro`:** formulario (datos personales y del negocio, cédula/RUC, WhatsApp) que crea una cuenta en estado *pendiente*.
- **`/cuenta`:** pantalla de estado para pendiente, rechazado o suspendido.
- **Panel `/mayorista`** (solo aprobados):
  - **Pedido mayorista:** catálogo con el precio de `obtener_precio_mayorista` y la matriz talla × cantidad; crea un pedido `mayorista` para el admin.
  - **Mi sección:** logo y banner (Storage `tiendas/{id}/`), colores con validación de contraste, WhatsApp, plantilla de mensaje y slug, con vista previa en vivo.
  - **Mis precios:** tabla con PVP, mi costo mayorista, mi precio y margen; edición masiva por %.
  - **Mis pedidos y leads.**
  - **Compartir:** enlace y QR de `/t/{slug}`.

Verifica que un lead no cambia el stock y que un pedido mayorista confirmado sí lo descuenta. Actualiza STATUS.
