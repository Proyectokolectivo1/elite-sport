-- Las devoluciones restan de la caja y del reporte de ventas el dia en que se registran.
-- Se descuentan en el mismo canal (y local y vendedor) de la venta original; si la venta se pago con un metodo, se resta de ese metodo.
-- En el reporte por tienda y vendedor aparecen como una fila "devolucion" con total negativo.

create or replace function resumen_ventas(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_filas jsonb; v_pend jsonb;
begin
  if not public.puede_ver_caja() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.canal, f.total desc, f.nombre), '[]'::jsonb) into v_filas from (
    select 'local'::text as canal, x.clave, x.nombre,
           sum(x.cuenta)::int as pedidos, sum(x.total) as total,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'efectivo'), 0) as efectivo,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'transferencia'), 0) as transferencia,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'tarjeta'), 0) as tarjeta,
           0::numeric as por_cobrar,
           case when x.local_id is not null then string_agg(distinct x.persona, ', ') end as detalle
      from (
        -- Venta de mostrador (flujo anterior).
        select p.total, p.metodo_pago::text as metodo_pago, l.id as local_id, 1 as cuenta,
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
        select p.total, null::text, l.id, 1,
               case when l.id is not null then 'local:' || l.id::text else coalesce(p.solicitante_id::text, 'sin-dato') end,
               coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'),
               coalesce('Local ' || l.nombre, coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'))
          from public.pedidos p
          join public.perfiles pf on pf.id = p.solicitante_id and pf.rol = 'vendedor'
          left join public.locales l on l.id = p.local_id
         where p.tipo = 'consignacion' and p.estado = 'liquidado' and p.total > 0
           and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
        union all
        -- Devoluciones de esas ventas: restan en el mismo local y persona.
        select -d.total, case when p.tipo = 'mostrador' then p.metodo_pago::text end, l.id, 0,
               case when l.id is not null then 'local:' || l.id::text else coalesce(p.solicitante_id::text, 'sin-dato') end,
               coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                 || case when pf.rol = 'admin' then ' (admin)' else '' end,
               coalesce('Local ' || l.nombre,
                        coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                          || case when pf.rol = 'admin' then ' (admin)' else '' end)
          from public.devoluciones d
          join public.pedidos p on p.id = d.pedido_id
          left join public.perfiles pf on pf.id = p.solicitante_id
          left join public.locales l on l.id = p.local_id
         where (p.tipo = 'mostrador' or (p.tipo = 'consignacion' and pf.rol = 'vendedor'))
           and d.creado_en >= p_desde and d.creado_en < p_hasta
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
    -- Tienda en linea, WhatsApp y mayoristas: ventas del periodo menos devoluciones del periodo.
    select w.canal, w.clave, w.nombre, sum(w.cuenta)::int, sum(w.total), 0, 0, 0, 0, null::text
      from (
        select case p.tipo when 'minorista' then 'web' when 'lead_tienda' then 'whatsapp' else 'mayoristas' end as canal,
               p.tipo::text as clave,
               case p.tipo when 'minorista' then 'Tienda en línea' when 'lead_tienda' then 'Pedidos por WhatsApp' else 'Pedidos de mayoristas' end as nombre,
               1 as cuenta, p.total
          from public.pedidos p
         where p.tipo in ('minorista', 'lead_tienda', 'mayorista') and p.estado in ('confirmado', 'entregado')
           and p.creado_en >= p_desde and p.creado_en < p_hasta
        union all
        select case p.tipo when 'minorista' then 'web' when 'lead_tienda' then 'whatsapp' else 'mayoristas' end,
               p.tipo::text,
               case p.tipo when 'minorista' then 'Tienda en línea' when 'lead_tienda' then 'Pedidos por WhatsApp' else 'Pedidos de mayoristas' end,
               0, -d.total
          from public.devoluciones d join public.pedidos p on p.id = d.pedido_id
         where p.tipo in ('minorista', 'lead_tienda', 'mayorista')
           and d.creado_en >= p_desde and d.creado_en < p_hasta
      ) w
     group by w.canal, w.clave, w.nombre
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
      select jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'fecha', coalesce(p.liquidado_en, p.creado_en),
        'local_id', p.local_id, 'local', l.nombre, 'vendedor_id', p.solicitante_id,
        'vendedor', coalesce(nullif(trim(pf.nombre), ''), nullif(trim(pf.negocio), ''), 'Sin nombre'),
        'cliente', p.cliente_nombre, 'documento', p.cliente_documento,
        'metodo_pago', p.metodo_pago, 'total', p.total, 'devolucion', false,
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
      select jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'fecha', p.liquidado_en,
        'local_id', p.local_id, 'local', l.nombre, 'vendedor_id', p.solicitante_id,
        'vendedor', coalesce(nullif(trim(pf.nombre), ''), nullif(trim(pf.negocio), ''), 'Sin nombre'),
        'cliente', 'Pedido a bodega', 'documento', null,
        'metodo_pago', null, 'total', p.total, 'devolucion', false,
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
      union all
      -- Devolucion de una de esas ventas: total negativo, en el mismo local y vendedor.
      select jsonb_build_object(
        'id', dv.id, 'numero', dv.numero, 'fecha', dv.creado_en,
        'local_id', p.local_id, 'local', l.nombre, 'vendedor_id', p.solicitante_id,
        'vendedor', coalesce(nullif(trim(pf.nombre), ''), nullif(trim(pf.negocio), ''), 'Sin nombre'),
        'cliente', 'Devolución del pedido #' || p.numero, 'documento', null,
        'metodo_pago', case when p.tipo = 'mostrador' then p.metodo_pago end, 'total', -dv.total, 'devolucion', true,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'descripcion', dd.descripcion, 'cantidad', dd.cantidad,
                      'precio', dd.precio_unitario, 'precio_lista', null) order by dd.descripcion), '[]'::jsonb)
                   from public.devoluciones_detalle dd where dd.devolucion_id = dv.id)
      )
      from public.devoluciones dv
      join public.pedidos p on p.id = dv.pedido_id
      left join public.perfiles pf on pf.id = p.solicitante_id
      left join public.locales l on l.id = p.local_id
      where (p.tipo = 'mostrador' or (p.tipo = 'consignacion' and pf.rol = 'vendedor'))
        and dv.creado_en >= p_desde and dv.creado_en < p_hasta
    ) u limit 5000
  ) q;
  return v_res;
end $$;
