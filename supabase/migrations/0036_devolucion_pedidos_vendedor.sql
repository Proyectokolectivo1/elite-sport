-- Devoluciones de ventas de vendedores de locales: un pedido a bodega ya cerrado (liquidado) se puede devolver
-- hasta lo que se vendio; los pares vuelven al inventario unico (la misma bodega). Mayorista del sector sigue por Bodega.
create or replace function registrar_devolucion(p_pedido uuid, p_lineas jsonb, p_motivo text, p_reintegrar boolean, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_l jsonb; v_d record; v_n int; v_ya int; v_id uuid; v_num bigint; v_total numeric := 0; v_cuantas int := 0;
  v_cons boolean; v_max int; v_reg int;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_motivo not in ('talla', 'defecto', 'no_gusto', 'error_pedido', 'otro') then raise exception 'Motivo no válido'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) not between 1 and 100 then
    raise exception 'Indica los pares que se devuelven';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  v_cons := v_p.tipo = 'consignacion';
  if v_cons then
    if v_p.estado <> 'liquidado'
       or not exists (select 1 from public.perfiles where id = v_p.solicitante_id and rol = 'vendedor') then
      raise exception 'Solo se devuelven ventas de vendedores ya cerradas por bodega';
    end if;
  elsif v_p.estado <> 'entregado' then
    raise exception 'Solo se devuelven pedidos ya entregados';
  end if;

  insert into public.devoluciones (pedido_id, motivo, reintegrado, nota, total, creado_por)
  values (p_pedido, p_motivo, coalesce(p_reintegrar, false), left(nullif(trim(p_nota), ''), 500), 0, (select auth.uid()))
  returning id, numero into v_id, v_num;

  for v_l in select * from jsonb_array_elements(p_lineas) order by (value->>'detalle_id') loop
    v_n := coalesce((v_l->>'cantidad')::int, 0);
    if v_n = 0 then continue; end if;
    select id, variante_id, descripcion, cantidad, cantidad_vendida, precio_unitario into v_d
      from public.pedidos_detalle where id = (v_l->>'detalle_id')::uuid and pedido_id = p_pedido for update;
    if not found then raise exception 'Hay líneas que no son de este pedido'; end if;
    select coalesce(sum(cantidad), 0) into v_ya from public.devoluciones_detalle where detalle_id = v_d.id;
    v_max := v_d.cantidad;
    if v_cons then
      -- Lo vendido, menos lo que el flujo anterior ya asento como venta de mostrador.
      select coalesce(sum(m.cantidad), 0) into v_reg
        from public.pedidos_detalle m join public.pedidos pm on pm.id = m.pedido_id
       where m.origen_detalle_id = v_d.id and pm.tipo = 'mostrador' and pm.estado in ('nuevo', 'entregado');
      v_max := greatest(v_d.cantidad_vendida - v_reg, 0);
    end if;
    if v_n < 0 or v_n > v_max - v_ya then
      raise exception 'No se pueden devolver % de %: quedan % por devolver', v_n, v_d.descripcion, greatest(v_max - v_ya, 0);
    end if;
    insert into public.devoluciones_detalle (devolucion_id, detalle_id, variante_id, descripcion, cantidad, precio_unitario)
    values (v_id, v_d.id, v_d.variante_id, v_d.descripcion, v_n, v_d.precio_unitario);
    if p_reintegrar then
      perform public._aplicar_stock(v_d.variante_id, v_n, 'devolucion', v_id, 'Devolución #' || v_num || ' del pedido #' || v_p.numero);
    end if;
    v_total := v_total + v_n * v_d.precio_unitario;
    v_cuantas := v_cuantas + v_n;
  end loop;

  if v_cuantas = 0 then raise exception 'Indica al menos un par'; end if;
  update public.devoluciones set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total, 'pares', v_cuantas);
end $$;
