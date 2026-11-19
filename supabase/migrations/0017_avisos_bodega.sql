-- Conteo liviano de lo pendiente para el bodeguero (avisos de pedidos nuevos).
-- El bodeguero no puede leer `pedidos`; esta función solo devuelve tres números, sin precios ni datos de personas.

create function public.contar_pendientes_bodega() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'por_despachar', (select count(*) from public.pedidos where tipo = 'consignacion' and estado = 'nuevo'),
    'en_poder',      (select count(*) from public.pedidos where tipo = 'consignacion' and estado = 'entregado'),
    'web',           (select count(*) from public.pedidos where tipo in ('minorista', 'mayorista') and estado = 'confirmado')
  );
end $$;

revoke execute on function public.contar_pendientes_bodega() from public, anon;
grant execute on function public.contar_pendientes_bodega() to authenticated;
