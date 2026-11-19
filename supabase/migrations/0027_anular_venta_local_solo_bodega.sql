-- Anular una venta del local: solo el admin o el bodeguero. El vendedor ya no puede anular lo que vendio.
-- La anulacion solo devuelve el par al saldo del vendedor (cantidad_vendida baja); no mueve el inventario.
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
    if v_p.estado <> 'entregado' then raise exception 'La venta no se puede anular'; end if;
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
