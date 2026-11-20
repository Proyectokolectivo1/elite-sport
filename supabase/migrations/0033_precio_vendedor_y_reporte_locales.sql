-- El vendedor fija el precio de venta (según la cantidad o el cliente) y el admin ve las ventas por local.
--  1. registrar_venta_local acepta "precio" por ítem (si no viene, usa el de lista). Cada línea guarda también el
--     precio de lista (precio_lista) para ver cuánto se rebajó. La venta sigue quedando "por cerrar" para el admin.
--  2. reporte_ventas_locales: solo admin. Ventas cerradas del local en el periodo, con su local, vendedor y líneas.

alter table pedidos_detalle add column precio_lista numeric(10, 2) check (precio_lista >= 0);

create or replace function registrar_venta_local(
  p_items jsonb, p_metodo_pago text default 'efectivo', p_cliente_nombre text default null,
  p_cliente_telefono text default null, p_cliente_correo text default null,
  p_cliente_documento text default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_id uuid; v_num bigint; v_total numeric := 0; v_moneda text;
  v_it jsonb; v_cant int; v_resta int; v_toma int; v_v record; v_o record; v_precio numeric;
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
    -- Precio del vendedor (opcional). Sin precio, se vende al de lista de la entrega.
    v_precio := null;
    if v_it ? 'precio' and jsonb_typeof(v_it->'precio') <> 'null' then
      v_precio := round((v_it->>'precio')::numeric, 2);
      if v_precio < 0 or v_precio > 1000000 then raise exception 'Precio inválido'; end if;
    end if;
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
      insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, precio_lista, origen_detalle_id)
      values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_toma,
              coalesce(v_precio, v_o.precio_unitario), v_o.precio_unitario, v_o.id);
      v_total := v_total + coalesce(v_precio, v_o.precio_unitario) * v_toma;
      v_resta := v_resta - v_toma;
    end loop;
    if v_resta > 0 then
      raise exception 'No tienes suficientes pares de % talla % en tu poder', v_v.nombre, v_v.etiqueta;
    end if;
  end loop;

  update public.pedidos set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total);
end $$;

-- Ventas anteriores del local: el precio de lista es el de la entrega de origen.
update pedidos_detalle d set precio_lista = o.precio_unitario
  from pedidos_detalle o, pedidos p
 where o.id = d.origen_detalle_id and p.id = d.pedido_id and p.tipo = 'mostrador' and d.precio_lista is null;

-- Reporte de ventas del local por tienda: solo el admin. Cuenta las ventas cerradas por la fecha del cierre.
create function reporte_ventas_locales(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;
  if p_hasta - p_desde > interval '93 days' then raise exception 'Elige un periodo de hasta 3 meses'; end if;

  select coalesce(jsonb_agg(v order by v->>'fecha'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'id', p.id, 'numero', p.numero, 'fecha', coalesce(p.liquidado_en, p.creado_en),
      'local_id', p.local_id, 'local', l.nombre,
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
    limit 5000
  ) q;
  return v_res;
end $$;

revoke execute on function reporte_ventas_locales(timestamptz, timestamptz) from public, anon;
grant execute on function reporte_ventas_locales(timestamptz, timestamptz) to authenticated;
