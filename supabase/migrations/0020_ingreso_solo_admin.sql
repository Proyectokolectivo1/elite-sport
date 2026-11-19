-- Solo el administrador ingresa mercancia al inventario. El bodeguero sigue pudiendo ajustar stock
-- (conteos), despachar y cerrar entregas, pero ya no registra ingresos.
create or replace function registrar_ingreso_inventario(
  p_tipo tipo_ingreso, p_producto_id uuid, p_num_cajas int, p_lineas jsonb,
  p_color text default null, p_proveedor text default null, p_referencia text default null, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_l jsonb; v_talla record; v_prod record; v_var uuid; v_cant int; v_color text; v_n int := 0;
  v_cajas int := case when p_tipo = 'caja' then p_num_cajas else 1 end;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id, slug, grupo into v_prod from public.productos where id = p_producto_id;
  if not found then raise exception 'Producto no encontrado'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'El ingreso no tiene líneas';
  end if;
  if v_cajas is null or v_cajas < 1 then raise exception 'Número de cajas inválido'; end if;

  insert into public.ingresos_inventario (tipo, num_cajas, proveedor, referencia, nota, creado_por)
  values (p_tipo, v_cajas, p_proveedor, p_referencia, p_nota, (select auth.uid()))
  returning id into v_id;

  for v_l in select * from jsonb_array_elements(p_lineas) loop
    v_color := trim(coalesce(v_l->>'color', p_color, ''));
    if v_color = '' then raise exception 'Falta el color'; end if;
    select t.id, t.etiqueta, t.grupo into v_talla from public.tallas t where t.id = (v_l->>'talla_id')::uuid;
    if not found then raise exception 'Talla no válida'; end if;
    if v_talla.grupo <> v_prod.grupo then raise exception 'La talla % no corresponde al grupo del producto', v_talla.etiqueta; end if;

    v_cant := coalesce((v_l->>'total')::int,
      case when p_tipo = 'caja' then (v_l->>'pares')::int * v_cajas else (v_l->>'pares')::int end);
    if v_cant is null or v_cant < 0 then raise exception 'Cantidad inválida para la talla %', v_talla.etiqueta; end if;
    if v_cant = 0 then continue; end if;

    insert into public.variantes_producto (producto_id, color, talla_id, sku)
    values (p_producto_id, v_color, v_talla.id,
      upper(left(replace(v_prod.slug, '-', ''), 8)) || '-' ||
      upper(left(regexp_replace(v_color, '[^a-zA-Z0-9]', '', 'g'), 3)) || left(md5(lower(v_color)), 2) || '-' ||
      v_talla.etiqueta || '-' || left(replace(p_producto_id::text, '-', ''), 4))
    on conflict (producto_id, color, talla_id) do update set color = excluded.color
    returning id into v_var;

    insert into public.ingresos_inventario_detalle (ingreso_id, variante_id, pares_por_caja, cantidad)
    values (v_id, v_var, (v_l->>'pares')::int, v_cant);
    perform public._aplicar_stock(v_var, v_cant, 'ingreso', v_id, p_nota);
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then raise exception 'Ninguna línea tiene cantidad'; end if;
  return v_id;
end $$;
