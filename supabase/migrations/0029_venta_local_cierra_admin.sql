-- Ventas del local en dos pasos:
--  1. El vendedor arma la venta con los pares que tiene en su poder. Queda "por cerrar" (estado nuevo), al precio
--     de la entrega de bodega: el vendedor ya no fija precios. El par queda apartado de su saldo.
--  2. El admin la cierra: fija el valor final de cada línea y la forma de pago. Ahí cuenta para la caja.
-- Ningún paso mueve el inventario central (el par ya salió al despachar la entrega).

-- 1. Registrar: igual que antes, pero sin precio del vendedor y en estado nuevo.
create or replace function registrar_venta_local(
  p_items jsonb, p_metodo_pago text default 'efectivo', p_cliente_nombre text default null,
  p_cliente_telefono text default null, p_cliente_correo text default null,
  p_cliente_documento text default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_id uuid; v_num bigint; v_total numeric := 0; v_moneda text;
  v_it jsonb; v_cant int; v_resta int; v_toma int; v_v record; v_o record;
begin
  if not public.es_vendedor() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_metodo_pago not in ('efectivo', 'transferencia', 'tarjeta') then raise exception 'Método de pago inválido'; end if;
  select moneda_codigo into v_moneda from public.configuracion where id = 1;

  insert into public.pedidos (tipo, estado, tienda_id, solicitante_id, cliente_nombre, cliente_telefono, cliente_correo,
                              cliente_documento, metodo_pago, nota, moneda, stock_descontado)
  values ('mostrador', 'nuevo', (select id from public.tiendas where es_principal), v_uid,
          coalesce(nullif(trim(p_cliente_nombre), ''), 'Consumidor final'),
          coalesce(nullif(trim(p_cliente_telefono), ''), 'Sin dato'),
          nullif(lower(trim(p_cliente_correo)), ''), nullif(trim(p_cliente_documento), ''),
          p_metodo_pago, left(p_nota, 500), v_moneda, false)
  returning id, numero into v_id, v_num;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_it->>'cantidad')::int;
    if v_cant is null or v_cant not between 1 and 1000 then raise exception 'Cantidad inválida'; end if;
    select va.id, va.color, p.nombre, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = (v_it->>'variante_id')::uuid;
    if not found then raise exception 'Producto no disponible'; end if;

    v_resta := v_cant;
    for v_o in
      select d.id, d.precio_unitario, d.cantidad_entregada - d.cantidad_vendida - d.cantidad_devuelta as libre
        from public.pedidos_detalle d join public.pedidos p on p.id = d.pedido_id
       where p.tipo = 'consignacion' and p.estado = 'entregado' and p.solicitante_id = v_uid
         and d.variante_id = v_v.id and d.cantidad_entregada - d.cantidad_vendida - d.cantidad_devuelta > 0
       order by p.despachado_en, d.id
       for update of d
    loop
      exit when v_resta = 0;
      v_toma := least(v_resta, v_o.libre);
      update public.pedidos_detalle set cantidad_vendida = cantidad_vendida + v_toma where id = v_o.id;
      insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, origen_detalle_id)
      values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_toma, v_o.precio_unitario, v_o.id);
      v_total := v_total + v_o.precio_unitario * v_toma;
      v_resta := v_resta - v_toma;
    end loop;
    if v_resta > 0 then
      raise exception 'No tienes suficientes pares de % talla % en tu poder', v_v.nombre, v_v.etiqueta;
    end if;
  end loop;

  update public.pedidos set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total);
end $$;

-- 2. Cerrar: solo el admin. p_lineas: [{"detalle_id": uuid, "precio": numeric}] (las que no vengan conservan su precio).
create function cerrar_venta_local(p_pedido uuid, p_lineas jsonb, p_metodo_pago text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_l jsonb; v_precio numeric; v_total numeric;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'mostrador' then raise exception 'Venta no encontrada'; end if;
  if v_p.estado <> 'nuevo' then raise exception 'Esta venta ya se cerró o se anuló'; end if;
  if p_metodo_pago not in ('efectivo', 'transferencia', 'tarjeta') then raise exception 'Método de pago inválido'; end if;
  if p_lineas is not null and jsonb_typeof(p_lineas) <> 'array' then raise exception 'Líneas no válidas'; end if;

  for v_l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_precio := (v_l->>'precio')::numeric;
    if v_precio is null or v_precio < 0 or v_precio > 100000 then raise exception 'Precio inválido'; end if;
    update public.pedidos_detalle set precio_unitario = round(v_precio, 2)
     where id = (v_l->>'detalle_id')::uuid and pedido_id = p_pedido;
    if not found then raise exception 'Hay líneas que no son de esta venta'; end if;
  end loop;

  select coalesce(sum(cantidad * precio_unitario), 0) into v_total from public.pedidos_detalle where pedido_id = p_pedido;
  update public.pedidos
     set estado = 'entregado', total = v_total, metodo_pago = p_metodo_pago,
         liquidado_por = (select auth.uid()), liquidado_en = now()
   where id = p_pedido;
  return jsonb_build_object('id', p_pedido, 'numero', v_p.numero, 'total', v_total);
end $$;

revoke execute on function cerrar_venta_local(uuid, jsonb, text) from public, anon;
grant execute on function cerrar_venta_local(uuid, jsonb, text) to authenticated;

-- 3. Anular: el admin o el bodeguero, tanto por cerrar como cerrada (mientras la entrega siga abierta).
create or replace function cancelar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record; v_o record;
begin
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;

  if v_p.tipo = 'consignacion' then
    if not (public.es_personal_bodega() or v_p.solicitante_id = (select auth.uid())) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if v_p.estado <> 'nuevo' then
      raise exception 'Una entrega ya despachada no se cancela: se cierra con los pares devueltos';
    end if;
    update public.pedidos set estado = 'cancelado' where id = p_pedido;
    return;
  end if;

  if exists (select 1 from public.pedidos_detalle where pedido_id = p_pedido and origen_detalle_id is not null) then
    if not public.es_personal_bodega() then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if v_p.estado not in ('nuevo', 'entregado') then raise exception 'La venta no se puede anular'; end if;
    for v_d in select origen_detalle_id, cantidad from public.pedidos_detalle
                where pedido_id = p_pedido order by origen_detalle_id loop
      select d.id, p.estado into v_o
        from public.pedidos_detalle d join public.pedidos p on p.id = d.pedido_id
        where d.id = v_d.origen_detalle_id for update of d;
      if v_o.estado <> 'entregado' then
        raise exception 'La entrega de bodega ya se cerró: pide al administrador un ajuste';
      end if;
      update public.pedidos_detalle set cantidad_vendida = cantidad_vendida - v_d.cantidad where id = v_d.origen_detalle_id;
    end loop;
    update public.pedidos set estado = 'cancelado' where id = p_pedido;
    return;
  end if;

  if not (public.es_admin() or (v_p.mayorista_id = (select auth.uid()) and v_p.estado = 'nuevo')) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_p.estado not in ('nuevo', 'confirmado') and not (v_p.tipo = 'mostrador' and v_p.estado = 'entregado') then
    raise exception 'El pedido no se puede cancelar';
  end if;
  if v_p.stock_descontado then
    for v_d in select variante_id, cantidad from public.pedidos_detalle where pedido_id = p_pedido order by variante_id loop
      perform public._aplicar_stock(v_d.variante_id, v_d.cantidad, 'anulacion', p_pedido, 'Anulación pedido #' || v_p.numero);
    end loop;
  end if;
  update public.pedidos set estado = 'cancelado', stock_descontado = false where id = p_pedido;
end $$;

-- 4. Liberar ventas al cuadrar una entrega: también reduce o anula las que siguen por cerrar.
create or replace function liberar_ventas_registradas(p_pedido uuid, p_lineas jsonb) returns void
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
       where s.origen_detalle_id = v_d.id and vp.estado in ('nuevo', 'entregado')
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


-- 5. Cierre de caja: la venta del local cuenta el día en que el admin la cierra, y avisa las que siguen por cerrar.
create or replace function resumen_ventas(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_filas jsonb; v_pend jsonb;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.canal, f.total desc, f.nombre), '[]'::jsonb) into v_filas from (
    -- Punto fisico: una fila por persona que registro ventas.
    select 'local'::text as canal, coalesce(p.solicitante_id::text, 'sin-dato') as clave,
           coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
             || case when pf.rol = 'admin' then ' (admin)' else '' end as nombre,
           count(*)::int as pedidos, sum(p.total) as total,
           coalesce(sum(p.total) filter (where p.metodo_pago = 'efectivo'), 0) as efectivo,
           coalesce(sum(p.total) filter (where p.metodo_pago = 'transferencia'), 0) as transferencia,
           coalesce(sum(p.total) filter (where p.metodo_pago = 'tarjeta'), 0) as tarjeta,
           0::numeric as por_cobrar
      from public.pedidos p left join public.perfiles pf on pf.id = p.solicitante_id
     where p.tipo = 'mostrador' and p.estado = 'entregado'
       and coalesce(p.liquidado_en, p.creado_en) >= p_desde and coalesce(p.liquidado_en, p.creado_en) < p_hasta
     group by p.solicitante_id, pf.negocio, pf.nombre, pf.rol
    union all
    -- Sector: cada mayorista, por los cierres de entrega del periodo.
    select 'sector', p.solicitante_id::text,
           coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'),
           count(*) filter (where p.total > 0)::int, coalesce(sum(p.total), 0), 0, 0, 0,
           coalesce(sum(p.total) filter (where p.pagado_en is null), 0)
      from public.pedidos p join public.perfiles pf on pf.id = p.solicitante_id
     where p.tipo = 'consignacion' and p.estado = 'liquidado' and pf.rol = 'mayorista_sector'
       and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
     group by p.solicitante_id, pf.negocio, pf.nombre
    union all
    -- Tienda web, pedidos por WhatsApp de tiendas de mayoristas y pedidos mayoristas.
    select case p.tipo when 'minorista' then 'web' when 'lead_tienda' then 'whatsapp' else 'mayoristas' end,
           p.tipo::text,
           case p.tipo when 'minorista' then 'Tienda en línea' when 'lead_tienda' then 'Pedidos por WhatsApp' else 'Pedidos de mayoristas' end,
           count(*)::int, sum(p.total), 0, 0, 0, 0
      from public.pedidos p
     where p.tipo in ('minorista', 'lead_tienda', 'mayorista') and p.estado in ('confirmado', 'entregado')
       and p.creado_en >= p_desde and p.creado_en < p_hasta
     group by p.tipo
  ) f;

  -- Ventas del local que siguen por cerrar (de cualquier fecha): avisan que la caja aún no está completa.
  select jsonb_build_object('pedidos', count(*)::int, 'total', coalesce(sum(total), 0)) into v_pend
    from public.pedidos where tipo = 'mostrador' and estado = 'nuevo';

  return jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'filas', v_filas, 'por_cerrar', v_pend);
end $$;

