-- Un par que el vendedor registró como vendido pero que en realidad regresa a bodega.
-- El personal de bodega libera esas ventas antes de cerrar o recibir la devolución: el par vuelve al saldo del
-- vendedor (cantidad_vendida baja) y la venta del local se reduce o se anula. El stock no se toca aquí: lo
-- mueve después devolver_a_bodega / cerrar_pedido_bodega al recibir el par.
create function liberar_ventas_registradas(p_pedido uuid, p_lineas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_l jsonb; v_d record; v_n int; v_resta int; v_toma int; v_v record; v_ped uuid;
  v_afectadas uuid[] := '{}';
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'consignacion' then raise exception 'Pedido a bodega no encontrado'; end if;
  if v_p.estado <> 'entregado' then raise exception 'Solo se corrigen entregas abiertas'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then raise exception 'Indica los pares a liberar'; end if;

  for v_l in select * from jsonb_array_elements(p_lineas) order by (value->>'detalle_id') loop
    v_n := coalesce((v_l->>'cantidad')::int, 0);
    if v_n = 0 then continue; end if;
    select id, cantidad_vendida into v_d from public.pedidos_detalle
     where id = (v_l->>'detalle_id')::uuid and pedido_id = p_pedido for update;
    if not found then raise exception 'Hay líneas que no son de este pedido'; end if;
    if v_n < 0 or v_n > coalesce(v_d.cantidad_vendida, 0) then
      raise exception 'No hay tantos pares registrados como vendidos';
    end if;
    update public.pedidos_detalle set cantidad_vendida = cantidad_vendida - v_n where id = v_d.id;

    -- Anula primero las ventas más recientes.
    v_resta := v_n;
    for v_v in
      select s.id, s.pedido_id, s.cantidad
        from public.pedidos_detalle s join public.pedidos vp on vp.id = s.pedido_id
       where s.origen_detalle_id = v_d.id and vp.estado = 'entregado'
       order by vp.creado_en desc, s.id for update of s
    loop
      exit when v_resta = 0;
      v_toma := least(v_resta, v_v.cantidad);
      if v_toma = v_v.cantidad then
        delete from public.pedidos_detalle where id = v_v.id;
      else
        update public.pedidos_detalle set cantidad = cantidad - v_toma where id = v_v.id;
      end if;
      v_resta := v_resta - v_toma;
      if not (v_v.pedido_id = any(v_afectadas)) then v_afectadas := v_afectadas || v_v.pedido_id; end if;
    end loop;
  end loop;

  foreach v_ped in array v_afectadas loop
    if exists (select 1 from public.pedidos_detalle where pedido_id = v_ped) then
      update public.pedidos set total = (select coalesce(sum(cantidad * precio_unitario), 0) from public.pedidos_detalle where pedido_id = v_ped),
             nota = left(coalesce(nota || ' · ', '') || 'Ajustada: pares devueltos a bodega en la entrega #' || v_p.numero, 500)
       where id = v_ped;
    else
      update public.pedidos set estado = 'cancelado', total = 0,
             nota = left(coalesce(nota || ' · ', '') || 'Anulada: pares devueltos a bodega en la entrega #' || v_p.numero, 500)
       where id = v_ped;
    end if;
  end loop;
end $$;

revoke execute on function liberar_ventas_registradas(uuid, jsonb) from public, anon;
grant execute on function liberar_ventas_registradas(uuid, jsonb) to authenticated;
