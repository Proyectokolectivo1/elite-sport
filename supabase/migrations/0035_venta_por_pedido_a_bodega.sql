-- Nuevo flujo de venta del local:
--  1. El vendedor elige del catálogo, pone SU precio por línea y envía el pedido a bodega (consignación).
--  2. El bodeguero despacha (el stock sale del inventario central) y, al cierre, anota vendidos y devueltos.
--     Al cerrar, la venta queda asentada al local y al vendedor por vendidos x precio del vendedor.
--  3. Ya no hay "Por cerrar" del admin ni venta registrada por el vendedor (registrar_venta_local se bloquea).
--  4. Rol cajero: ve la caja y las ventas por local y vendedor, igual que el admin pero sin acciones.

create function es_cajero() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'cajero' and estado = 'aprobado');
$$;

-- Puede ver la caja y los reportes de ventas: admin o cajero.
create function puede_ver_caja() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol in ('admin', 'cajero') and estado = 'aprobado');
$$;

revoke execute on function es_cajero(), puede_ver_caja() from public, anon;
grant execute on function es_cajero(), puede_ver_caja() to authenticated;

-- ============ 1. Pedido a bodega con el precio del vendedor ============
create or replace function solicitar_a_bodega(p_items jsonb, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_sector boolean; v_perfil record; v_moneda text;
  v_id uuid; v_num bigint; v_it record; v_v record; v_precio numeric; v_e jsonb; v_p numeric;
begin
  v_sector := public.es_mayorista_sector();
  if not (v_sector or public.es_vendedor()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'El pedido no tiene productos';
  end if;
  for v_e in select * from jsonb_array_elements(p_items) loop
    if (v_e->>'cantidad')::int is null or (v_e->>'cantidad')::int not between 1 and 1000 then
      raise exception 'Cantidad inválida';
    end if;
    if v_e ? 'precio' and jsonb_typeof(v_e->'precio') <> 'null' then
      v_p := (v_e->>'precio')::numeric;
      if v_p < 0 or v_p > 1000000 then raise exception 'Precio inválido'; end if;
    end if;
  end loop;

  -- Hay stock para la suma de todas las líneas de cada talla.
  for v_it in
    select (e->>'variante_id')::uuid as variante_id, sum((e->>'cantidad')::int)::int as cantidad
      from jsonb_array_elements(p_items) e group by 1
  loop
    select va.stock, p.nombre, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_it.variante_id;
    if not found then raise exception 'Producto no disponible'; end if;
    if v_v.stock < v_it.cantidad then
      raise exception 'No hay suficientes pares de % talla %. Pide menos o elige otra talla.', v_v.nombre, v_v.etiqueta;
    end if;
  end loop;

  select nombre, negocio, telefono into v_perfil from public.perfiles where id = v_uid;
  select moneda_codigo into v_moneda from public.configuracion where id = 1;

  insert into public.pedidos (tipo, estado, solicitante_id, cliente_nombre, cliente_telefono, nota, moneda, total)
  values ('consignacion', 'nuevo', v_uid,
          coalesce(nullif(trim(v_perfil.negocio), ''), nullif(trim(v_perfil.nombre), ''), 'Sin nombre'),
          coalesce(nullif(trim(v_perfil.telefono), ''), 'Sin dato'),
          left(p_nota, 500), v_moneda, 0)
  returning id, numero into v_id, v_num;

  for v_it in
    select (e->>'variante_id')::uuid as variante_id, sum((e->>'cantidad')::int)::int as cantidad,
           case when not v_sector and e ? 'precio' and jsonb_typeof(e->'precio') <> 'null'
                then round((e->>'precio')::numeric, 2) end as precio
      from jsonb_array_elements(p_items) e group by 1, 3 order by 1, 3
  loop
    select va.id, va.color, p.id as producto_id, p.nombre, p.precio_publico, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_it.variante_id;
    if v_sector then
      v_precio := public.obtener_precio_mayorista(v_v.producto_id, v_uid);
      if v_precio is null then raise exception 'El producto % no tiene precio mayorista', v_v.nombre; end if;
    else
      v_precio := coalesce(v_it.precio, v_v.precio_publico);
    end if;
    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, precio_lista)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_it.cantidad, v_precio,
            case when v_sector then null else v_v.precio_publico end);
  end loop;

  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

-- ============ 2. El cierre del bodeguero asienta la venta del vendedor ============
create or replace function cerrar_pedido_bodega(p_pedido uuid, p_lineas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_rol public.rol_usuario; v_d record; v_l jsonb; v_vend int; v_dev int; v_reg int;
  v_total numeric := 0; v_total_vend numeric := 0;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'consignacion' then raise exception 'Pedido a bodega no encontrado'; end if;
  if v_p.estado <> 'entregado' then raise exception 'Solo se cierran entregas abiertas'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then raise exception 'Faltan las cantidades del cierre'; end if;
  if exists (select 1 from jsonb_array_elements(p_lineas) l
              where not exists (select 1 from public.pedidos_detalle d
                                 where d.pedido_id = p_pedido and d.id = (l->>'detalle_id')::uuid)) then
    raise exception 'Hay líneas que no son de este pedido';
  end if;
  select rol into v_rol from public.perfiles where id = v_p.solicitante_id;

  for v_d in select id, variante_id, descripcion, precio_unitario, cantidad_entregada, cantidad_vendida, cantidad_devuelta
               from public.pedidos_detalle where pedido_id = p_pedido order by variante_id, id for update loop
    v_l := null;
    select l into v_l from jsonb_array_elements(p_lineas) l where (l->>'detalle_id')::uuid = v_d.id limit 1;
    v_vend := coalesce((v_l->>'vendidos')::int, v_d.cantidad_vendida);
    v_dev := coalesce((v_l->>'devueltos')::int, 0);
    if v_vend < 0 or v_dev < 0 then raise exception 'Cantidades inválidas en %', v_d.descripcion; end if;
    if v_vend < v_d.cantidad_vendida then
      raise exception 'En % ya hay % vendidos registrados', v_d.descripcion, v_d.cantidad_vendida;
    end if;
    if v_vend + v_dev + v_d.cantidad_devuelta <> v_d.cantidad_entregada then
      raise exception 'No cuadra %: entregados %, vendidos %, devueltos %',
        v_d.descripcion, v_d.cantidad_entregada, v_vend, v_dev + v_d.cantidad_devuelta;
    end if;

    -- Ventas del flujo anterior (registradas por el vendedor) ya cuentan en su propia venta: no se duplican.
    select coalesce(sum(m.cantidad), 0) into v_reg
      from public.pedidos_detalle m join public.pedidos pm on pm.id = m.pedido_id
     where m.origen_detalle_id = v_d.id and pm.tipo = 'mostrador' and pm.estado in ('nuevo', 'entregado');

    update public.pedidos_detalle set cantidad_vendida = v_vend, cantidad_devuelta = cantidad_devuelta + v_dev where id = v_d.id;
    if v_dev > 0 then
      perform public._aplicar_stock(v_d.variante_id, v_dev, 'devolucion', p_pedido, 'Cierre entrega #' || v_p.numero);
    end if;
    v_total := v_total + v_vend * v_d.precio_unitario;
    v_total_vend := v_total_vend + greatest(v_vend - v_reg, 0) * v_d.precio_unitario;
  end loop;

  update public.pedidos
     set estado = 'liquidado',
         total = case v_rol when 'mayorista_sector' then v_total when 'vendedor' then v_total_vend else 0 end,
         liquidado_por = (select auth.uid()), liquidado_en = now()
   where id = p_pedido;

  return jsonb_build_object('id', p_pedido, 'venta_sin_registrar', null);
end $$;

-- ============ 3. El vendedor ya no registra ventas por su cuenta ============
create or replace function registrar_venta_local(
  p_items jsonb, p_metodo_pago text default 'efectivo', p_cliente_nombre text default null,
  p_cliente_telefono text default null, p_cliente_correo text default null,
  p_cliente_documento text default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Las ventas se hacen con el pedido a bodega: pide los pares con tu precio y el bodeguero asienta la venta al cierre.';
end $$;

-- ============ 4. Caja y reportes: venta cerrada por bodega, visibles para admin y cajero ============
create or replace function resumen_ventas(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_filas jsonb; v_pend jsonb;
begin
  if not public.puede_ver_caja() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.canal, f.total desc, f.nombre), '[]'::jsonb) into v_filas from (
    select 'local'::text as canal, x.clave, x.nombre,
           count(*)::int as pedidos, sum(x.total) as total,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'efectivo'), 0) as efectivo,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'transferencia'), 0) as transferencia,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'tarjeta'), 0) as tarjeta,
           0::numeric as por_cobrar,
           case when x.local_id is not null then string_agg(distinct x.persona, ', ') end as detalle
      from (
        select p.total, p.metodo_pago::text as metodo_pago, l.id as local_id, p.solicitante_id,
               case when l.id is not null then 'local:' || l.id::text else coalesce(p.solicitante_id::text, 'sin-dato') end as clave,
               coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                 || case when pf.rol = 'admin' then ' (admin)' else '' end as persona,
               coalesce('Local ' || l.nombre,
                        coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                          || case when pf.rol = 'admin' then ' (admin)' else '' end) as nombre
          from public.pedidos p
          left join public.perfiles pf on pf.id = p.solicitante_id
          left join public.locales l on l.id = p.local_id
         where p.tipo = 'mostrador' and p.estado = 'entregado'
           and coalesce(p.liquidado_en, p.creado_en) >= p_desde and coalesce(p.liquidado_en, p.creado_en) < p_hasta
        union all
        -- Pedido a bodega de un vendedor, ya cerrado por el bodeguero.
        select p.total, null::text, l.id, p.solicitante_id,
               case when l.id is not null then 'local:' || l.id::text else coalesce(p.solicitante_id::text, 'sin-dato') end,
               coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'),
               coalesce('Local ' || l.nombre, coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'))
          from public.pedidos p
          join public.perfiles pf on pf.id = p.solicitante_id and pf.rol = 'vendedor'
          left join public.locales l on l.id = p.local_id
         where p.tipo = 'consignacion' and p.estado = 'liquidado' and p.total > 0
           and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
      ) x
     group by x.clave, x.nombre, x.local_id
    union all
    select 'sector', p.solicitante_id::text,
           coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'),
           count(*) filter (where p.total > 0)::int, coalesce(sum(p.total), 0), 0, 0, 0,
           coalesce(sum(p.total) filter (where p.pagado_en is null), 0), null::text
      from public.pedidos p join public.perfiles pf on pf.id = p.solicitante_id
     where p.tipo = 'consignacion' and p.estado = 'liquidado' and pf.rol = 'mayorista_sector'
       and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
     group by p.solicitante_id, pf.negocio, pf.nombre
    union all
    select case p.tipo when 'minorista' then 'web' when 'lead_tienda' then 'whatsapp' else 'mayoristas' end,
           p.tipo::text,
           case p.tipo when 'minorista' then 'Tienda en línea' when 'lead_tienda' then 'Pedidos por WhatsApp' else 'Pedidos de mayoristas' end,
           count(*)::int, sum(p.total), 0, 0, 0, 0, null::text
      from public.pedidos p
     where p.tipo in ('minorista', 'lead_tienda', 'mayorista') and p.estado in ('confirmado', 'entregado')
       and p.creado_en >= p_desde and p.creado_en < p_hasta
     group by p.tipo
  ) f;

  select jsonb_build_object('pedidos', count(*)::int, 'total', coalesce(sum(total), 0)) into v_pend
    from public.pedidos where tipo = 'mostrador' and estado = 'nuevo';

  return jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'filas', v_filas, 'por_cerrar', v_pend);
end $$;

create or replace function reporte_ventas_locales(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb;
begin
  if not public.puede_ver_caja() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;
  if p_hasta - p_desde > interval '93 days' then raise exception 'Elige un periodo de hasta 3 meses'; end if;

  select coalesce(jsonb_agg(v order by v->>'fecha'), '[]'::jsonb) into v_res from (
    select * from (
      -- Ventas del flujo anterior: registradas por el vendedor y cerradas por el admin.
      select jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'fecha', coalesce(p.liquidado_en, p.creado_en),
        'local_id', p.local_id, 'local', l.nombre, 'vendedor_id', p.solicitante_id,
        'vendedor', coalesce(nullif(trim(pf.nombre), ''), nullif(trim(pf.negocio), ''), 'Sin nombre'),
        'cliente', p.cliente_nombre, 'documento', p.cliente_documento,
        'metodo_pago', p.metodo_pago, 'total', p.total,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'descripcion', d.descripcion, 'cantidad', d.cantidad,
                      'precio', d.precio_unitario, 'precio_lista', d.precio_lista) order by d.descripcion), '[]'::jsonb)
                   from public.pedidos_detalle d where d.pedido_id = p.id)
      ) as v
      from public.pedidos p
      left join public.perfiles pf on pf.id = p.solicitante_id
      left join public.locales l on l.id = p.local_id
      where p.tipo = 'mostrador' and p.estado = 'entregado'
        and coalesce(p.liquidado_en, p.creado_en) >= p_desde and coalesce(p.liquidado_en, p.creado_en) < p_hasta
      union all
      -- Pedido a bodega de un vendedor cerrado por el bodeguero: lo vendido, al precio del vendedor.
      select jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'fecha', p.liquidado_en,
        'local_id', p.local_id, 'local', l.nombre, 'vendedor_id', p.solicitante_id,
        'vendedor', coalesce(nullif(trim(pf.nombre), ''), nullif(trim(pf.negocio), ''), 'Sin nombre'),
        'cliente', 'Pedido a bodega', 'documento', null,
        'metodo_pago', null, 'total', p.total,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'descripcion', d.descripcion, 'cantidad', d.cantidad_vendida,
                      'precio', d.precio_unitario, 'precio_lista', d.precio_lista) order by d.descripcion), '[]'::jsonb)
                   from public.pedidos_detalle d where d.pedido_id = p.id and d.cantidad_vendida > 0)
      )
      from public.pedidos p
      join public.perfiles pf on pf.id = p.solicitante_id and pf.rol = 'vendedor'
      left join public.locales l on l.id = p.local_id
      where p.tipo = 'consignacion' and p.estado = 'liquidado' and p.total > 0
        and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
    ) u limit 5000
  ) q;
  return v_res;
end $$;
