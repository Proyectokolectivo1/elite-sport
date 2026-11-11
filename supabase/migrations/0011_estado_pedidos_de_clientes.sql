-- El dueño de una tienda de mayorista atiende los pedidos de SUS clientes (tipo lead_tienda).
-- No toca el inventario central: solo cambia el estado del pedido. Transiciones permitidas:
--   nuevo -> confirmado | cancelado ;  confirmado -> entregado | cancelado
create function actualizar_estado_pedido_cliente(p_pedido uuid, p_estado estado_pedido) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record;
begin
  select p.id, p.tipo, p.estado, t.propietario_id into v_p
    from public.pedidos p left join public.tiendas t on t.id = p.tienda_id
    where p.id = p_pedido for update of p;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.tipo <> 'lead_tienda' then raise exception 'Solo se gestionan pedidos de clientes de la tienda'; end if;
  if not (public.es_admin() or v_p.propietario_id = (select auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not ((v_p.estado = 'nuevo' and p_estado in ('confirmado', 'cancelado'))
       or (v_p.estado = 'confirmado' and p_estado in ('entregado', 'cancelado'))) then
    raise exception 'No se puede pasar de % a %', v_p.estado, p_estado;
  end if;
  update public.pedidos set estado = p_estado where id = p_pedido;
end $$;

revoke execute on function actualizar_estado_pedido_cliente(uuid, estado_pedido) from public, anon;
grant execute on function actualizar_estado_pedido_cliente(uuid, estado_pedido) to authenticated;
