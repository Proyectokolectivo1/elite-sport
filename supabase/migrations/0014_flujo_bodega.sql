-- Flujo de bodega: el vendedor del local y el mayorista del sector piden pares, el bodeguero los entrega
-- (salen del stock y quedan en su poder) y al cierre confirma por línea cuántos se vendieron y cuántos regresan.
--   consignacion: nuevo -> entregado (stock -entregados, motivo despacho) -> liquidado (stock +devueltos, motivo devolucion)
--                 nuevo -> cancelado (sin tocar stock)
-- El saldo en el libro es -vendidos y cada movimiento lleva referencia_id = pedido.

-- ============ Ayudantes por rol ============
create function es_bodeguero() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'bodeguero' and estado = 'aprobado');
$$;

create function es_vendedor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'vendedor' and estado = 'aprobado');
$$;

create function es_mayorista_sector() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'mayorista_sector' and estado = 'aprobado');
$$;

-- Admin o bodeguero: despachan, cierran, ingresan mercadería y ajustan stock.
create function es_personal_bodega() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol in ('admin', 'bodeguero') and estado = 'aprobado');
$$;

revoke execute on function es_bodeguero(), es_vendedor(), es_mayorista_sector(), es_personal_bodega() from public, anon;
grant execute on function es_bodeguero(), es_vendedor(), es_mayorista_sector(), es_personal_bodega() to authenticated;

-- ============ Columnas ============
alter table pedidos
  add column solicitante_id uuid references perfiles(id) on delete set null,
  add column despachado_por uuid references perfiles(id) on delete set null,
  add column despachado_en timestamptz,
  add column liquidado_por uuid references perfiles(id) on delete set null,
  add column liquidado_en timestamptz;
comment on column pedidos.solicitante_id is 'Quien pidió a bodega (consignacion) o quien registró la venta del local.';
create index on pedidos (solicitante_id);
create index on pedidos (tipo, estado);
create index on pedidos (despachado_por);
create index on pedidos (liquidado_por);

alter table pedidos_detalle
  add column cantidad_entregada int,
  add column cantidad_vendida int,
  add column cantidad_devuelta int,
  add column origen_detalle_id uuid references pedidos_detalle(id) on delete restrict,
  add constraint pedidos_detalle_cuadre_bodega check (
    cantidad_entregada is null or (
      cantidad_entregada between 0 and cantidad
      and coalesce(cantidad_vendida, 0) >= 0
      and coalesce(cantidad_devuelta, 0) >= 0
      and coalesce(cantidad_vendida, 0) + coalesce(cantidad_devuelta, 0) <= cantidad_entregada));
comment on column pedidos_detalle.origen_detalle_id is 'En una venta del local: la línea de la entrega de bodega de la que salió el par.';
create index on pedidos_detalle (origen_detalle_id);

-- ============ La tienda /t/slug solo existe para el rol mayorista ============
create or replace function sincronizar_tienda_mayorista() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slug text; v_base text;
begin
  if new.rol <> 'mayorista' then
    update public.tiendas set activa = false where propietario_id = new.id and activa;
    return new;
  end if;
  if new.estado = 'aprobado' then
    v_base := public.slugify(coalesce(nullif(new.negocio, ''), new.nombre));
    if v_base = '' then v_base := 'tienda'; end if;
    v_slug := v_base;
    if exists (select 1 from public.tiendas where slug = v_slug) then
      v_slug := v_base || '-' || left(replace(new.id::text, '-', ''), 4);
    end if;
    insert into public.tiendas (propietario_id, slug, nombre, whatsapp)
    values (new.id, v_slug, coalesce(nullif(new.negocio, ''), new.nombre), new.telefono)
    on conflict (propietario_id) do update set activa = true;
  else
    update public.tiendas set activa = false where propietario_id = new.id;
  end if;
  return new;
end $$;

drop trigger sincronizar_tienda_mayorista on perfiles;
create trigger sincronizar_tienda_mayorista after update of estado, rol on perfiles
  for each row when (old.estado is distinct from new.estado or old.rol is distinct from new.rol)
  execute function public.sincronizar_tienda_mayorista();

-- ============ Funciones existentes que cambian ============
-- Precio mayorista: también lo consulta el mayorista del sector (solo el suyo).
create or replace function obtener_precio_mayorista(p_producto uuid, p_mayorista uuid default null)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v_may uuid := coalesce(p_mayorista, (select auth.uid())); v_base numeric; v_esp record;
begin
  if not (public.es_admin()
          or ((public.es_mayorista_aprobado() or public.es_mayorista_sector()) and v_may = (select auth.uid()))) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select precio into v_base from public.precios_mayorista where producto_id = p_producto;
  select precio, descuento_pct into v_esp from public.precios_especiales_mayorista
    where producto_id = p_producto and mayorista_id = v_may;
  if found then
    if v_esp.precio is not null then return v_esp.precio; end if;
    if v_base is not null then return round(v_base * (1 - v_esp.descuento_pct / 100), 2); end if;
  end if;
  return v_base;
end $$;

-- Ingreso de mercadería: admin o bodeguero.
create or replace function registrar_ingreso_inventario(
  p_tipo tipo_ingreso, p_producto_id uuid, p_num_cajas int, p_lineas jsonb,
  p_color text default null, p_proveedor text default null, p_referencia text default null, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_l jsonb; v_talla record; v_prod record; v_var uuid; v_cant int; v_color text; v_n int := 0;
  v_cajas int := case when p_tipo = 'caja' then p_num_cajas else 1 end;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id, slug, grupo into v_prod from public.productos where id = p_producto_id;
  if not found then raise exception 'Producto no encontrado'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'El ingreso no tiene líneas';
  end if;
  if v_cajas is null or v_cajas < 1 then raise exception 'Número de cajas inválido'; end if;

  insert into public.ingresos_inventario (tipo, num_cajas, proveedor, referencia, nota, creado_por)
  values (p_tipo, v_cajas, p_proveedor, p_referencia, p_nota, (select auth.uid()))
  returning id into v_id;

  for v_l in select * from jsonb_array_elements(p_lineas) loop
    v_color := trim(coalesce(v_l->>'color', p_color, ''));
    if v_color = '' then raise exception 'Falta el color'; end if;
    select t.id, t.etiqueta, t.grupo into v_talla from public.tallas t where t.id = (v_l->>'talla_id')::uuid;
    if not found then raise exception 'Talla no válida'; end if;
    if v_talla.grupo <> v_prod.grupo then raise exception 'La talla % no corresponde al grupo del producto', v_talla.etiqueta; end if;

    v_cant := coalesce((v_l->>'total')::int,
      case when p_tipo = 'caja' then (v_l->>'pares')::int * v_cajas else (v_l->>'pares')::int end);
    if v_cant is null or v_cant < 0 then raise exception 'Cantidad inválida para la talla %', v_talla.etiqueta; end if;
    if v_cant = 0 then continue; end if;

    insert into public.variantes_producto (producto_id, color, talla_id, sku)
    values (p_producto_id, v_color, v_talla.id,
      upper(left(replace(v_prod.slug, '-', ''), 8)) || '-' ||
      upper(left(regexp_replace(v_color, '[^a-zA-Z0-9]', '', 'g'), 3)) || left(md5(lower(v_color)), 2) || '-' ||
      v_talla.etiqueta || '-' || left(replace(p_producto_id::text, '-', ''), 4))
    on conflict (producto_id, color, talla_id) do update set color = excluded.color
    returning id into v_var;

    insert into public.ingresos_inventario_detalle (ingreso_id, variante_id, pares_por_caja, cantidad)
    values (v_id, v_var, (v_l->>'pares')::int, v_cant);
    perform public._aplicar_stock(v_var, v_cant, 'ingreso', v_id, p_nota);
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then raise exception 'Ninguna línea tiene cantidad'; end if;
  return v_id;
end $$;

-- Ajuste de stock: admin o bodeguero.
create or replace function ajustar_stock(p_variante uuid, p_delta int, p_nota text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_delta = 0 then raise exception 'El ajuste no puede ser 0'; end if;
  if coalesce(trim(p_nota), '') = '' then raise exception 'El ajuste requiere una nota'; end if;
  perform public._aplicar_stock(p_variante, p_delta, 'ajuste', null, p_nota);
end $$;

-- crear_pedido solo crea pedidos de la web (minorista, mayorista, lead_tienda).
create or replace function crear_pedido(
  p_tipo tipo_pedido, p_cliente_nombre text, p_cliente_telefono text, p_items jsonb,
  p_tienda_id uuid default null, p_nota text default null,
  p_cliente_correo text default null, p_cliente_direccion text default null, p_cliente_documento text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ip text;
  v_tel text := regexp_replace(coalesce(p_cliente_telefono, ''), '[^0-9]', '', 'g');
  v_por_ip int; v_por_tel int; v_res jsonb;
begin
  if p_tipo is null or p_tipo not in ('minorista', 'mayorista', 'lead_tienda') then
    raise exception 'Tipo de pedido no válido';
  end if;
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

-- confirmar_pedido: solo pedidos de la web. Los pedidos a bodega se despachan.
create or replace function confirmar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.estado <> 'nuevo' then raise exception 'Solo se confirman pedidos nuevos'; end if;
  if v_p.tipo = 'lead_tienda' then raise exception 'Los pedidos de tiendas de mayoristas no afectan el inventario'; end if;
  if v_p.tipo not in ('minorista', 'mayorista') then raise exception 'Este pedido no se confirma: se despacha desde bodega'; end if;
  for v_d in select variante_id, cantidad from public.pedidos_detalle where pedido_id = p_pedido order by variante_id loop
    perform public._aplicar_stock(v_d.variante_id, -v_d.cantidad,
      case when v_p.tipo = 'mayorista' then 'pedido_mayorista'::public.motivo_movimiento else 'venta'::public.motivo_movimiento end,
      p_pedido, 'Pedido #' || v_p.numero);
  end loop;
  update public.pedidos set estado = 'confirmado', stock_descontado = true where id = p_pedido;
end $$;

-- entregar_pedido: el bodeguero también marca como entregados los pedidos web confirmados.
create or replace function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.pedidos set estado = 'entregado'
   where id = p_pedido and estado = 'confirmado' and tipo in ('minorista', 'mayorista');
  if not found then raise exception 'Solo se entregan pedidos confirmados'; end if;
end $$;

-- cancelar_pedido:
--  * pedido a bodega: solo en "nuevo" (no tocó stock). Lo cancela quien lo pidió, el bodeguero o el admin.
--  * venta del local: devuelve los pares al saldo del vendedor mientras la entrega siga abierta.
--  * resto: igual que antes.
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
    if not (public.es_admin() or (public.es_vendedor() and v_p.solicitante_id = (select auth.uid()))) then
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

-- ============ Pedido a bodega ============
-- p_items: [{"variante_id": uuid, "cantidad": int}]. Precio: PVP para el vendedor, el suyo para el mayorista del sector.
create function solicitar_a_bodega(p_items jsonb, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_sector boolean; v_perfil record; v_moneda text;
  v_id uuid; v_num bigint; v_it record; v_v record; v_precio numeric; v_e jsonb;
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
    select (e->>'variante_id')::uuid as variante_id, sum((e->>'cantidad')::int)::int as cantidad
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select va.id, va.stock, va.color, p.id as producto_id, p.nombre, p.precio_publico, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_it.variante_id;
    if not found then raise exception 'Producto no disponible'; end if;
    if v_v.stock < v_it.cantidad then
      raise exception 'Stock insuficiente de % talla % (hay %)', v_v.nombre, v_v.etiqueta, v_v.stock;
    end if;
    if v_sector then
      v_precio := public.obtener_precio_mayorista(v_v.producto_id, v_uid);
      if v_precio is null then raise exception 'El producto % no tiene precio mayorista', v_v.nombre; end if;
    else
      v_precio := v_v.precio_publico;
    end if;
    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_it.cantidad, v_precio);
  end loop;

  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

-- Despacho: p_lineas [{"detalle_id": uuid, "entregados": int}]. Una línea omitida se entrega completa.
create function despachar_pedido_bodega(p_pedido uuid, p_lineas jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record; v_ent int; v_total int := 0; v_quien text;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'consignacion' then raise exception 'Pedido a bodega no encontrado'; end if;
  if v_p.estado <> 'nuevo' then raise exception 'Este pedido ya fue despachado o cancelado'; end if;
  if p_lineas is not null and (jsonb_typeof(p_lineas) <> 'array' or exists (
       select 1 from jsonb_array_elements(p_lineas) l
        where not exists (select 1 from public.pedidos_detalle d
                           where d.pedido_id = p_pedido and d.id = (l->>'detalle_id')::uuid))) then
    raise exception 'Hay líneas que no son de este pedido';
  end if;
  v_quien := v_p.cliente_nombre;

  for v_d in select id, variante_id, cantidad from public.pedidos_detalle where pedido_id = p_pedido order by variante_id loop
    v_ent := coalesce((select (l->>'entregados')::int from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) l
                        where (l->>'detalle_id')::uuid = v_d.id limit 1), v_d.cantidad);
    if v_ent < 0 or v_ent > v_d.cantidad then raise exception 'No se puede entregar más de lo pedido'; end if;
    update public.pedidos_detalle
       set cantidad_entregada = v_ent, cantidad_vendida = 0, cantidad_devuelta = 0
     where id = v_d.id;
    if v_ent > 0 then
      perform public._aplicar_stock(v_d.variante_id, -v_ent, 'despacho', p_pedido,
        'Entrega #' || v_p.numero || ' a ' || v_quien);
    end if;
    v_total := v_total + v_ent;
  end loop;
  if v_total = 0 then raise exception 'Indica al menos un par para entregar'; end if;

  update public.pedidos
     set estado = 'entregado', stock_descontado = true,
         despachado_por = (select auth.uid()), despachado_en = now()
   where id = p_pedido;
end $$;

-- Devolución parcial antes del cierre: p_lineas [{"detalle_id": uuid, "devueltos": int}].
create function devolver_a_bodega(p_pedido uuid, p_lineas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_l jsonb; v_d record; v_n int; v_total int := 0;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found or v_p.tipo <> 'consignacion' then raise exception 'Pedido a bodega no encontrado'; end if;
  if v_p.estado <> 'entregado' then raise exception 'Solo se reciben devoluciones de entregas abiertas'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then raise exception 'Indica los pares que regresan'; end if;

  for v_l in select * from jsonb_array_elements(p_lineas) order by (value->>'detalle_id') loop
    v_n := coalesce((v_l->>'devueltos')::int, 0);
    if v_n = 0 then continue; end if;
    select id, variante_id, cantidad_entregada, cantidad_vendida, cantidad_devuelta into v_d
      from public.pedidos_detalle where id = (v_l->>'detalle_id')::uuid and pedido_id = p_pedido for update;
    if not found then raise exception 'Hay líneas que no son de este pedido'; end if;
    if v_n < 0 or v_n > v_d.cantidad_entregada - v_d.cantidad_vendida - v_d.cantidad_devuelta then
      raise exception 'Regresan más pares de los que tiene en su poder';
    end if;
    update public.pedidos_detalle set cantidad_devuelta = cantidad_devuelta + v_n where id = v_d.id;
    perform public._aplicar_stock(v_d.variante_id, v_n, 'devolucion', p_pedido, 'Devolución parcial entrega #' || v_p.numero);
    v_total := v_total + v_n;
  end loop;
  if v_total = 0 then raise exception 'Indica al menos un par que regresa'; end if;
end $$;

-- Cierre: p_lineas [{"detalle_id": uuid, "vendidos": int, "devueltos": int}]
--   vendidos  = total vendido de la línea (incluye lo que el vendedor ya registró)
--   devueltos = pares que regresan ahora
--   Debe cumplirse: vendidos + devueltos + devueltos antes = entregados, y vendidos >= ya registrados.
-- Mayorista del sector: la venta definitiva es este pedido (total = vendidos × su precio).
-- Vendedor: sus ventas son los pedidos "mostrador"; lo vendido sin registrar se guarda como una venta aparte.
create function cerrar_pedido_bodega(p_pedido uuid, p_lineas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_rol public.rol_usuario; v_d record; v_l jsonb; v_vend int; v_dev int;
  v_extra jsonb := '[]'::jsonb; v_venta uuid; v_num_venta bigint; v_total numeric := 0; v_total_venta numeric := 0; v_x jsonb;
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
               from public.pedidos_detalle where pedido_id = p_pedido order by variante_id for update loop
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

    if v_vend > v_d.cantidad_vendida then
      v_extra := v_extra || jsonb_build_object('detalle_id', v_d.id, 'variante_id', v_d.variante_id,
        'descripcion', v_d.descripcion, 'cantidad', v_vend - v_d.cantidad_vendida, 'precio', v_d.precio_unitario);
    end if;
    update public.pedidos_detalle set cantidad_vendida = v_vend, cantidad_devuelta = cantidad_devuelta + v_dev where id = v_d.id;
    if v_dev > 0 then
      perform public._aplicar_stock(v_d.variante_id, v_dev, 'devolucion', p_pedido, 'Cierre entrega #' || v_p.numero);
    end if;
    v_total := v_total + v_vend * v_d.precio_unitario;
  end loop;

  -- Vendedor: lo vendido que no registró queda como venta en el local (a PVP, efectivo) para que el admin lo revise.
  if v_rol = 'vendedor' and jsonb_array_length(v_extra) > 0 then
    insert into public.pedidos (tipo, estado, tienda_id, solicitante_id, cliente_nombre, cliente_telefono,
                                metodo_pago, nota, moneda, stock_descontado)
    values ('mostrador', 'entregado', (select id from public.tiendas where es_principal), v_p.solicitante_id,
            'Consumidor final', 'Sin dato', 'efectivo',
            'Venta sin registrar al cierre de la entrega #' || v_p.numero, v_p.moneda, false)
    returning id, numero into v_venta, v_num_venta;
    for v_x in select * from jsonb_array_elements(v_extra) loop
      insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, origen_detalle_id)
      values (v_venta, (v_x->>'variante_id')::uuid, v_x->>'descripcion', (v_x->>'cantidad')::int,
              (v_x->>'precio')::numeric, (v_x->>'detalle_id')::uuid);
      v_total_venta := v_total_venta + (v_x->>'cantidad')::int * (v_x->>'precio')::numeric;
    end loop;
    update public.pedidos set total = v_total_venta where id = v_venta;
  end if;

  update public.pedidos
     set estado = 'liquidado',
         total = case when v_rol = 'mayorista_sector' then v_total else 0 end,
         liquidado_por = (select auth.uid()), liquidado_en = now()
   where id = p_pedido;

  return jsonb_build_object('id', p_pedido, 'venta_sin_registrar', v_num_venta);
end $$;

-- Venta del local con lo que el vendedor tiene en su poder. No toca el stock (ya salió al despachar).
-- p_items: [{"variante_id": uuid, "cantidad": int, "precio": numeric?}]  (sin precio usa el PVP)
create function registrar_venta_local(
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
  values ('mostrador', 'entregado', (select id from public.tiendas where es_principal), v_uid,
          coalesce(nullif(trim(p_cliente_nombre), ''), 'Consumidor final'),
          coalesce(nullif(trim(p_cliente_telefono), ''), 'Sin dato'),
          nullif(lower(trim(p_cliente_correo)), ''), nullif(trim(p_cliente_documento), ''),
          p_metodo_pago, left(p_nota, 500), v_moneda, false)
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

    v_resta := v_cant;
    for v_o in
      select d.id, d.cantidad_entregada - d.cantidad_vendida - d.cantidad_devuelta as libre
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
      values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_toma, v_precio, v_o.id);
      v_resta := v_resta - v_toma;
    end loop;
    if v_resta > 0 then
      raise exception 'No tienes suficientes pares de % talla % en tu poder', v_v.nombre, v_v.etiqueta;
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.pedidos set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total);
end $$;

-- Saldo de pares en poder del vendedor o del mayorista del sector, por variante.
create function mis_pares_en_poder() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x->>'producto', x->>'color', (x->>'talla_orden')::int), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'variante_id', va.id, 'producto_id', pr.id, 'producto', pr.nombre, 'color', va.color,
      'talla', t.etiqueta, 'talla_orden', t.orden,
      'en_poder', sum(d.cantidad_entregada - d.cantidad_vendida - d.cantidad_devuelta)::int,
      'precio', max(d.precio_unitario)) as x
    from public.pedidos p
    join public.pedidos_detalle d on d.pedido_id = p.id
    join public.variantes_producto va on va.id = d.variante_id
    join public.productos pr on pr.id = va.producto_id
    join public.tallas t on t.id = va.talla_id
    where p.tipo = 'consignacion' and p.estado = 'entregado' and p.solicitante_id = (select auth.uid())
      and (public.es_vendedor() or public.es_mayorista_sector())
    group by va.id, pr.id, pr.nombre, va.color, t.etiqueta, t.orden
    having sum(d.cantidad_entregada - d.cantidad_vendida - d.cantidad_devuelta) > 0
  ) s;
$$;

-- Lista para bodega SIN precios ni totales. p_vista:
--   por_despachar: pedidos a bodega nuevos · en_poder: entregas abiertas · web: pedidos web confirmados
--   historial: pedidos a bodega cerrados o cancelados en los últimos 7 días
create function listar_pedidos_bodega(p_vista text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_vista not in ('por_despachar', 'en_poder', 'web', 'historial') then raise exception 'Vista no válida'; end if;

  select coalesce(jsonb_agg(fila order by orden_fecha), '[]'::jsonb) into v_res from (
    select
      case when p_vista = 'historial' then -extract(epoch from coalesce(p.liquidado_en, p.creado_en))
           else extract(epoch from coalesce(p.despachado_en, p.creado_en)) end as orden_fecha,
      jsonb_build_object(
        'id', p.id, 'numero', p.numero, 'tipo', p.tipo, 'estado', p.estado, 'creado_en', p.creado_en,
        'despachado_en', p.despachado_en, 'liquidado_en', p.liquidado_en, 'nota', p.nota,
        'solicitante_id', p.solicitante_id,
        'solicitante_nombre', coalesce(nullif(s.negocio, ''), s.nombre, p.cliente_nombre),
        'solicitante_rol', s.rol,
        'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono,
        'cliente_direccion', p.cliente_direccion,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', d.id, 'variante_id', d.variante_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
                      'cantidad_entregada', d.cantidad_entregada, 'cantidad_vendida', d.cantidad_vendida,
                      'cantidad_devuelta', d.cantidad_devuelta, 'stock', va.stock) order by d.descripcion), '[]'::jsonb)
                   from public.pedidos_detalle d join public.variantes_producto va on va.id = d.variante_id
                   where d.pedido_id = p.id)
      ) as fila
    from public.pedidos p
    left join public.perfiles s on s.id = p.solicitante_id
    where case p_vista
      when 'por_despachar' then p.tipo = 'consignacion' and p.estado = 'nuevo'
      when 'en_poder' then p.tipo = 'consignacion' and p.estado = 'entregado'
      when 'web' then p.tipo in ('minorista', 'mayorista') and p.estado = 'confirmado'
      else p.tipo = 'consignacion' and p.estado in ('liquidado', 'cancelado')
           and coalesce(p.liquidado_en, p.creado_en) > now() - interval '7 days'
    end
    order by 1
    limit 200
  ) q;
  return v_res;
end $$;

revoke execute on function solicitar_a_bodega(jsonb, text), despachar_pedido_bodega(uuid, jsonb),
  devolver_a_bodega(uuid, jsonb), cerrar_pedido_bodega(uuid, jsonb),
  registrar_venta_local(jsonb, text, text, text, text, text, text), mis_pares_en_poder(),
  listar_pedidos_bodega(text) from public, anon;
grant execute on function solicitar_a_bodega(jsonb, text), despachar_pedido_bodega(uuid, jsonb),
  devolver_a_bodega(uuid, jsonb), cerrar_pedido_bodega(uuid, jsonb),
  registrar_venta_local(jsonb, text, text, text, text, text, text), mis_pares_en_poder(),
  listar_pedidos_bodega(text) to authenticated;

-- ============ RLS por rol ============
-- Pedidos: quien pidió a bodega o registró la venta del local ve lo suyo.
-- El bodeguero no lee la tabla (vería precios): usa listar_pedidos_bodega.
drop policy "admin, mayorista o dueno de tienda lee" on pedidos;
create policy "admin, mayorista, solicitante o dueno de tienda lee" on pedidos for select to authenticated
  using (public.es_admin() or mayorista_id = (select auth.uid()) or solicitante_id = (select auth.uid())
    or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())));

-- Precio mayorista: también el mayorista del sector. Nunca bodeguero ni vendedor.
drop policy "mayorista aprobado o admin lee" on precios_mayorista;
create policy "mayorista aprobado o admin lee" on precios_mayorista for select to authenticated
  using (public.es_admin() or public.es_mayorista_aprobado() or public.es_mayorista_sector());

-- Productos: el bodeguero también ve los inactivos (para el ingreso de mercadería).
drop policy "lee activos o admin" on productos;
create policy "lee activos, admin o bodeguero" on productos for select to authenticated
  using (activo or public.es_personal_bodega());

-- Curvas de caja: el bodeguero las lee para el ingreso por caja; solo el admin las edita.
drop policy "admin lee" on curvas_tallas;
create policy "admin o bodeguero lee" on curvas_tallas for select to authenticated using (public.es_personal_bodega());
drop policy "admin lee" on curvas_tallas_detalle;
create policy "admin o bodeguero lee" on curvas_tallas_detalle for select to authenticated using (public.es_personal_bodega());
