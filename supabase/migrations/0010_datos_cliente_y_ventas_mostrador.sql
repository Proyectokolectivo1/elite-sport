-- Datos del cliente en cada pedido (Ecuador: cédula o RUC), dirección del mayorista y ventas en el punto físico.

alter table perfiles add column direccion text;

create or replace function manejar_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, telefono, cedula_ruc, ciudad, negocio, correo, direccion)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'cedula_ruc',
    new.raw_user_meta_data->>'ciudad',
    new.raw_user_meta_data->>'negocio',
    new.email,
    new.raw_user_meta_data->>'direccion');
  return new;
end $$;
revoke execute on function manejar_nuevo_usuario() from public, anon, authenticated;

alter table pedidos
  add column cliente_correo text,
  add column cliente_direccion text,
  add column cliente_documento text,
  add column metodo_pago text check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta'));

-- crear_pedido ahora exige correo, dirección y cédula o RUC.
drop function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text);

create function crear_pedido(
  p_tipo tipo_pedido, p_cliente_nombre text, p_cliente_telefono text, p_items jsonb,
  p_tienda_id uuid default null, p_nota text default null,
  p_cliente_correo text default null, p_cliente_direccion text default null, p_cliente_documento text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ip text;
  v_tel text := regexp_replace(coalesce(p_cliente_telefono, ''), '[^0-9]', '', 'g');
  v_por_ip int; v_por_tel int; v_res jsonb;
begin
  if coalesce(trim(p_cliente_correo), '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Correo inválido';
  end if;
  if length(trim(coalesce(p_cliente_direccion, ''))) < 5 then raise exception 'Dirección inválida'; end if;
  if coalesce(trim(p_cliente_documento), '') !~ '^([0-9]{10}|[0-9]{13})$' then
    raise exception 'La cédula o el RUC deben tener 10 o 13 dígitos';
  end if;

  if p_tipo <> 'mayorista' then
    v_ip := coalesce(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
    v_ip := coalesce(nullif(trim(v_ip), ''), 'desconocida');
    delete from public.intentos_pedido where creado_en < now() - interval '2 days';
    select count(*) into v_por_ip from public.intentos_pedido where ip = v_ip and creado_en > now() - interval '1 hour';
    select count(*) into v_por_tel from public.intentos_pedido where telefono = v_tel and creado_en > now() - interval '1 hour';
    if v_por_ip >= 15 or v_por_tel >= 6 then
      raise exception 'Demasiados pedidos en poco tiempo. Intenta de nuevo en una hora.' using errcode = 'P0001';
    end if;
    insert into public.intentos_pedido (ip, telefono) values (v_ip, v_tel);
  end if;

  v_res := public._crear_pedido(p_tipo, p_cliente_nombre, p_cliente_telefono, p_items, p_tienda_id, p_nota);
  update public.pedidos
     set cliente_correo = lower(trim(p_cliente_correo)),
         cliente_direccion = left(trim(p_cliente_direccion), 200),
         cliente_documento = trim(p_cliente_documento)
   where id = (v_res->>'id')::uuid;
  return v_res;
end $$;

revoke execute on function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text, text, text, text) from public;
grant execute on function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text, text, text, text) to anon, authenticated;

-- Una venta en el punto físico se puede anular (repone el stock), además de los pedidos nuevos o confirmados.
create or replace function cancelar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record;
begin
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
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

-- Venta en el punto físico: queda entregada y descuenta el inventario al instante.
-- p_items: [{"variante_id": uuid, "cantidad": int, "precio": numeric?}]  (sin precio usa el PVP)
create function registrar_venta_mostrador(
  p_items jsonb, p_metodo_pago text default 'efectivo', p_cliente_nombre text default null,
  p_cliente_telefono text default null, p_cliente_correo text default null,
  p_cliente_documento text default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_num bigint; v_total numeric := 0; v_it jsonb; v_cant int; v_v record; v_precio numeric; v_moneda text;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_metodo_pago not in ('efectivo', 'transferencia', 'tarjeta') then raise exception 'Método de pago inválido'; end if;
  select moneda_codigo into v_moneda from public.configuracion where id = 1;

  insert into public.pedidos (tipo, estado, tienda_id, cliente_nombre, cliente_telefono, cliente_correo, cliente_documento,
                              metodo_pago, nota, moneda, stock_descontado)
  values ('mostrador', 'entregado', (select id from public.tiendas where es_principal),
          coalesce(nullif(trim(p_cliente_nombre), ''), 'Consumidor final'),
          coalesce(nullif(trim(p_cliente_telefono), ''), 'Sin dato'),
          nullif(lower(trim(p_cliente_correo)), ''), nullif(trim(p_cliente_documento), ''),
          p_metodo_pago, left(p_nota, 500), v_moneda, true)
  returning id, numero into v_id, v_num;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_it->>'cantidad')::int;
    if v_cant is null or v_cant not between 1 and 1000 then raise exception 'Cantidad inválida'; end if;
    select va.id, va.color, p.nombre, p.precio_publico, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = (v_it->>'variante_id')::uuid;
    if not found then raise exception 'Producto no disponible'; end if;
    v_precio := coalesce((v_it->>'precio')::numeric, v_v.precio_publico);
    if v_precio < 0 then raise exception 'Precio inválido'; end if;
    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_cant, v_precio);
    perform public._aplicar_stock(v_v.id, -v_cant, 'venta', v_id, 'Venta en tienda #' || v_num);
    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.pedidos set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total);
end $$;

revoke execute on function registrar_venta_mostrador(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function registrar_venta_mostrador(jsonb, text, text, text, text, text, text) to authenticated;
