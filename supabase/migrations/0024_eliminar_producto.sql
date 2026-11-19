-- Eliminar un producto aunque ya tenga pedidos, ingresos o movimientos.
-- Sin historial se borra del todo. Con historial no se puede borrar la fila (los pedidos, el libro de
-- movimientos y las entregas de bodega apuntan a sus tallas), así que se marca como eliminado: sale de
-- Productos, de la tienda y del inventario, y los pedidos y el historial se conservan tal cual.

alter table productos add column eliminado_en timestamptz;

create function eliminar_producto(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not exists (select 1 from public.productos where id = p_id and eliminado_en is null) then
    raise exception 'Producto no encontrado';
  end if;
  begin
    delete from public.productos where id = p_id;
    return 'borrado';
  exception when foreign_key_violation then
    -- Libera el slug para poder crear otro producto con el mismo nombre.
    update public.productos
       set activo = false, destacado = false, eliminado_en = now(),
           slug = left(slug, 60) || '-eliminado-' || left(replace(id::text, '-', ''), 8)
     where id = p_id;
    return 'archivado';
  end;
end $$;

revoke execute on function eliminar_producto(uuid) from public, anon;
grant execute on function eliminar_producto(uuid) to authenticated;

-- Las existencias (inventario, totales del admin y del dashboard) ya no cuentan productos eliminados.
create or replace view existencias_variantes with (security_barrier = true) as
  select v.id, v.producto_id, v.color, v.talla_id, v.sku, v.stock
  from public.variantes_producto v
  join public.productos p on p.id = v.producto_id
  where public.es_personal_bodega() and p.eliminado_en is null;
