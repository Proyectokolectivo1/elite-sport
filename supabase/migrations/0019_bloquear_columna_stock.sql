-- Cierra la lectura directa de `stock` por la API. Se aplica después de desplegar el sitio que lee
-- `disponible` (0018); antes rompería la tienda en producción.
-- Los permisos por columna dejan fuera `stock` para anon y authenticated (incluido el admin por la API):
-- admin y bodeguero lo leen de existencias_variantes.
revoke select on variantes_producto from anon, authenticated;
grant select (id, producto_id, color, talla_id, sku, disponible) on variantes_producto to anon, authenticated;
