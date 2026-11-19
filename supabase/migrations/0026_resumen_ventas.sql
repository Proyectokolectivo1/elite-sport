-- Cierre de caja del admin: ventas del periodo por canal.
--  * local: ventas del punto fisico (mostrador) por cada persona que vende, con su forma de pago.
--  * sector: lo que cada mayorista del sector vendio (cierres de entrega, a su precio de mayorista).
--  * web / whatsapp / mayoristas: pedidos de la tienda confirmados o entregados.
-- Las anuladas y canceladas no cuentan. Solo el admin la ejecuta.
create function resumen_ventas(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_filas jsonb;
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
     where p.tipo = 'mostrador' and p.estado = 'entregado' and p.creado_en >= p_desde and p.creado_en < p_hasta
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

  return jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'filas', v_filas);
end $$;

revoke execute on function resumen_ventas(timestamptz, timestamptz) from public, anon;
grant execute on function resumen_ventas(timestamptz, timestamptz) to authenticated;
