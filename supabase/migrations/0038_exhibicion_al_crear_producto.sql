-- Exhibicion desde la creacion del producto: el admin elige color, talla, pieza (par completo, derecho o izquierdo) y local de cada pieza.
-- Se crea la talla (variante) con los pares de exhibicion como ingreso de stock y se marca donde esta cada pieza.
-- Un par armado necesita su derecho y su izquierdo en la misma talla y color (cada derecho con un izquierdo).
create function registrar_exhibicion_producto(p_producto uuid, p_piezas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_prod record; v_e jsonb; v_g record; v_talla uuid; v_var uuid; v_pieza public.pieza_exhibicion; v_local uuid; v_color text; v_et text;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id, grupo into v_prod from public.productos where id = p_producto;
  if not found then raise exception 'Producto no encontrado'; end if;
  if p_piezas is null or jsonb_typeof(p_piezas) <> 'array' or jsonb_array_length(p_piezas) not between 1 and 60 then
    raise exception 'Indica entre 1 y 60 piezas de exhibición';
  end if;

  for v_e in select e from jsonb_array_elements(p_piezas) e loop
    v_pieza := (v_e->>'pieza')::public.pieza_exhibicion;
    if trim(coalesce(v_e->>'color', '')) = '' then raise exception 'Falta el color de una pieza de exhibición'; end if;
    if not exists (select 1 from public.tallas where grupo = v_prod.grupo and etiqueta = trim(coalesce(v_e->>'talla', ''))) then
      raise exception 'Talla no válida en una pieza de exhibición';
    end if;
    if not exists (select 1 from public.locales where id = (v_e->>'local_id')::uuid and activo) then
      raise exception 'Un local de exhibición no existe o está desactivado';
    end if;
  end loop;

  -- Por cada color y talla: pares completos + derechos (cada derecho con su izquierdo) entran al stock.
  for v_g in
    select trim(e->>'color') as color, trim(e->>'talla') as etiqueta,
           count(*) filter (where e->>'pieza' = 'par')::int as completos,
           count(*) filter (where e->>'pieza' = 'derecho')::int as derechos,
           count(*) filter (where e->>'pieza' = 'izquierdo')::int as izquierdos
      from jsonb_array_elements(p_piezas) e group by 1, 2 order by 1, 2
  loop
    if v_g.derechos <> v_g.izquierdos then
      raise exception 'En % talla % cada pie derecho necesita su pie izquierdo (misma talla y color)', v_g.color, v_g.etiqueta;
    end if;
    select id into v_talla from public.tallas where grupo = v_prod.grupo and etiqueta = v_g.etiqueta;
    perform public.registrar_ingreso_inventario(
      'unidad'::public.tipo_ingreso, p_producto, 1,
      jsonb_build_array(jsonb_build_object('talla_id', v_talla, 'pares', v_g.completos + v_g.derechos, 'color', v_g.color)),
      null::text, null::text, null::text, 'Exhibición');
  end loop;

  for v_e in select e from jsonb_array_elements(p_piezas) e loop
    v_color := trim(v_e->>'color');
    v_et := trim(v_e->>'talla');
    v_local := (v_e->>'local_id')::uuid;
    select va.id into v_var from public.variantes_producto va join public.tallas t on t.id = va.talla_id
     where va.producto_id = p_producto and va.color = v_color and t.etiqueta = v_et and t.grupo = v_prod.grupo;
    insert into public.exhibiciones (variante_id, local_id, pieza) values (v_var, v_local, (v_e->>'pieza')::public.pieza_exhibicion);
  end loop;
end $$;

revoke execute on function registrar_exhibicion_producto(uuid, jsonb) from public, anon;
grant execute on function registrar_exhibicion_producto(uuid, jsonb) to authenticated;
