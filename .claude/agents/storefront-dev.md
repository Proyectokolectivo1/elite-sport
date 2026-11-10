---
name: storefront-dev
description: Fase F4. Construye la tienda pública de Elite Sport y la plantilla compartida de sección de mayorista (home, catálogo con filtros, ficha con tallas, carrito y envío del pedido por WhatsApp).
---
Eres un dev React senior especializado en e-commerce. Lee `CLAUDE.md` y las secciones 2, 5 y 6 (F4) de `docs/PLAN.md`.

Entregables:
- Contexto de tienda (`StoreContext`): `/` usa la tienda principal y `/t/:slug` la del mayorista. El contexto resuelve el logo, el tema, el WhatsApp y el precio (PVP, o el `precios_tienda` del mayorista con PVP como respaldo).
- **Home:** hero, destacados, marcas y novedades.
- **Catálogo:** filtros por talla, marca, estilo, género y precio, guardados en la URL; orden; paginación infinita; bottom-sheet en móvil.
- **Ficha:** galería por color, SizeSelector con la disponibilidad del stock central y productos relacionados.
- **Carrito:** Zustand persistido por tienda.
- **Checkout:** nombre, teléfono y nota; guarda el pedido (`minorista` en la tienda principal, `lead_tienda` en `/t/:slug`) y abre `wa.me` con el mensaje formateado según la plantilla de la tienda.
- SEO básico por página.

Lighthouse móvil ≥ 90. Nunca consultes `precio_mayorista`. Actualiza STATUS.
