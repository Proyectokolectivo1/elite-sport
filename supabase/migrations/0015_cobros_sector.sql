-- Cobro a los mayoristas del sector.
-- Al cerrar una entrega, el total (vendidos x su precio de mayorista) es lo que el mayorista debe pagar.
-- Esta migración deja registrar cuándo lo pagó. Solo el admin marca un pago; el mayorista solo lo ve.

alter table public.pedidos
  add column pagado_en timestamptz,
  add column pagado_por uuid references public.perfiles(id) on delete set null;
create index on public.pedidos (pagado_por);
comment on column public.pedidos.pagado_en is 'Cuándo el mayorista del sector pagó este cierre (null = por cobrar).';

create function public.marcar_pago_consignacion(p_pedido uuid, p_pagado boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id, tipo, estado, total into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'consignacion' then raise exception 'Pedido a bodega no encontrado'; end if;
  if v_p.estado <> 'liquidado' then raise exception 'Solo se cobra una entrega ya cerrada'; end if;
  if v_p.total <= 0 then raise exception 'Esta entrega no tiene nada que cobrar'; end if;
  update public.pedidos
     set pagado_en = case when p_pagado then now() else null end,
         pagado_por = case when p_pagado then (select auth.uid()) else null end
   where id = p_pedido;
end $$;

revoke execute on function public.marcar_pago_consignacion(uuid, boolean) from public, anon;
grant execute on function public.marcar_pago_consignacion(uuid, boolean) to authenticated;
