-- ============ Ayudantes ============
create function es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin' and estado = 'aprobado');
$$;

create function es_mayorista_aprobado() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'mayorista' and estado = 'aprobado');
$$;

create function slugify(t text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from lower(regexp_replace(
    translate(coalesce(t, ''), 'áéíóúñÁÉÍÓÚÑüÜ', 'aeiounAEIOUNuU'), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

-- ============ Triggers ============
create function manejar_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, telefono, cedula_ruc, ciudad, negocio)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'cedula_ruc',
    new.raw_user_meta_data->>'ciudad',
    new.raw_user_meta_data->>'negocio');
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario();

create function proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.es_admin()
     and (new.rol <> old.rol or new.estado <> old.estado) then
    raise exception 'Solo el administrador puede cambiar el rol o el estado' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger proteger_perfil before update on perfiles
  for each row execute function public.proteger_perfil();

create function sincronizar_tienda_mayorista() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_slug text; v_base text;
begin
  if new.rol <> 'mayorista' then return new; end if;
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

create trigger sincronizar_tienda_mayorista after update of estado on perfiles
  for each row when (old.estado is distinct from new.estado)
  execute function public.sincronizar_tienda_mayorista();

create function proteger_tienda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.es_admin()
     and (new.propietario_id is distinct from old.propietario_id or new.es_principal <> old.es_principal) then
    raise exception 'No puedes cambiar el propietario ni la tienda principal' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger proteger_tienda before update on tiendas
  for each row execute function public.proteger_tienda();

-- El stock solo cambia desde las funciones RPC (bandera de sesión)
create function proteger_stock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.stock_rpc', true), '') <> 'on' then
    if tg_op = 'INSERT' and new.stock <> 0 then
      raise exception 'El stock solo se modifica con las funciones de inventario';
    elsif tg_op = 'UPDATE' and new.stock <> old.stock then
      raise exception 'El stock solo se modifica con las funciones de inventario';
    end if;
  end if;
  return new;
end $$;

create trigger proteger_stock before insert or update on variantes_producto
  for each row execute function public.proteger_stock();

-- ============ Stock (interno) ============
create function _aplicar_stock(p_variante uuid, p_delta int, p_motivo motivo_movimiento, p_ref uuid, p_nota text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_stock int;
begin
  select stock into v_stock from public.variantes_producto where id = p_variante for update;
  if not found then raise exception 'Variante no encontrada'; end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente (disponible %, solicitado %)', v_stock, -p_delta;
  end if;
  perform set_config('app.stock_rpc', 'on', true);
  update public.variantes_producto set stock = stock + p_delta where id = p_variante;
  perform set_config('app.stock_rpc', 'off', true);
  insert into public.movimientos_inventario (variante_id, delta, motivo, referencia_id, nota, creado_por)
  values (p_variante, p_delta, p_motivo, p_ref, p_nota, (select auth.uid()));
end $$;
revoke all on function _aplicar_stock(uuid, int, motivo_movimiento, uuid, text) from public, anon, authenticated;

-- ============ Precio mayorista ============
create function obtener_precio_mayorista(p_producto uuid, p_mayorista uuid default null)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v_may uuid := coalesce(p_mayorista, (select auth.uid())); v_base numeric; v_esp record;
begin
  if not (public.es_admin() or (public.es_mayorista_aprobado() and v_may = (select auth.uid()))) then
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

-- ============ Ingreso de mercancía (caja -> unidades por talla) ============
-- p_lineas: [{"talla_id": uuid, "pares": int, "total": int?, "color": text?}]
--  caja:   unidades = pares * p_num_cajas (o "total" si el admin lo edita)
--  unidad: unidades = "total" o "pares"
create function registrar_ingreso_inventario(
  p_tipo tipo_ingreso, p_producto_id uuid, p_num_cajas int, p_lineas jsonb,
  p_color text default null, p_proveedor text default null, p_referencia text default null, p_nota text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_l jsonb; v_talla record; v_prod record; v_var uuid; v_cant int; v_color text; v_n int := 0;
  v_cajas int := case when p_tipo = 'caja' then p_num_cajas else 1 end;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
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

create function ajustar_stock(p_variante uuid, p_delta int, p_nota text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_delta = 0 then raise exception 'El ajuste no puede ser 0'; end if;
  if coalesce(trim(p_nota), '') = '' then raise exception 'El ajuste requiere una nota'; end if;
  perform public._aplicar_stock(p_variante, p_delta, 'ajuste', null, p_nota);
end $$;

-- ============ Pedidos ============
-- p_items: [{"variante_id": uuid, "cantidad": int}]. Los precios se calculan en el servidor.
create function crear_pedido(
  p_tipo tipo_pedido, p_cliente_nombre text, p_cliente_telefono text, p_items jsonb,
  p_tienda_id uuid default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cfg record; v_tienda uuid; v_may uuid; v_id uuid; v_num bigint; v_total numeric := 0;
  v_it jsonb; v_v record; v_cant int; v_precio numeric;
begin
  if length(trim(coalesce(p_cliente_nombre, ''))) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
  if coalesce(p_cliente_telefono, '') !~ '^[0-9+() -]{7,20}$' then raise exception 'Teléfono inválido'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'El pedido no tiene productos';
  end if;
  select moneda_codigo into v_cfg from public.configuracion where id = 1;

  if p_tipo = 'minorista' then
    select id into v_tienda from public.tiendas where es_principal;
  elsif p_tipo = 'lead_tienda' then
    select id into v_tienda from public.tiendas where id = p_tienda_id and activa and not es_principal;
    if v_tienda is null then raise exception 'Tienda no disponible'; end if;
  else
    if not public.es_mayorista_aprobado() then raise exception 'Solo mayoristas aprobados' using errcode = '42501'; end if;
    v_may := (select auth.uid());
  end if;

  insert into public.pedidos (tipo, tienda_id, mayorista_id, cliente_nombre, cliente_telefono, nota, moneda)
  values (p_tipo, v_tienda, v_may, trim(p_cliente_nombre), trim(p_cliente_telefono), left(p_nota, 500), v_cfg.moneda_codigo)
  returning id, numero into v_id, v_num;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cant := (v_it->>'cantidad')::int;
    if v_cant is null or v_cant not between 1 and 1000 then raise exception 'Cantidad inválida'; end if;
    select va.id, va.stock, va.color, p.id as producto_id, p.nombre, p.precio_publico, t.etiqueta
      into v_v from public.variantes_producto va
      join public.productos p on p.id = va.producto_id and p.activo
      join public.tallas t on t.id = va.talla_id
      where va.id = (v_it->>'variante_id')::uuid;
    if not found then raise exception 'Producto no disponible'; end if;
    if p_tipo <> 'lead_tienda' and v_v.stock < v_cant then
      raise exception 'Stock insuficiente de % talla %', v_v.nombre, v_v.etiqueta;
    end if;

    if p_tipo = 'mayorista' then
      v_precio := public.obtener_precio_mayorista(v_v.producto_id);
      if v_precio is null then raise exception 'Producto sin precio mayorista'; end if;
    elsif p_tipo = 'lead_tienda' then
      select coalesce((select precio from public.precios_tienda where tienda_id = v_tienda and producto_id = v_v.producto_id), v_v.precio_publico)
        into v_precio;
    else
      v_precio := v_v.precio_publico;
    end if;

    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_cant, v_precio);
    v_total := v_total + v_precio * v_cant;
  end loop;

  update public.pedidos set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total);
end $$;

create function confirmar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.estado <> 'nuevo' then raise exception 'Solo se confirman pedidos nuevos'; end if;
  if v_p.tipo = 'lead_tienda' then raise exception 'Los pedidos de tiendas de mayoristas no afectan el inventario'; end if;
  for v_d in select variante_id, cantidad from public.pedidos_detalle where pedido_id = p_pedido order by variante_id loop
    perform public._aplicar_stock(v_d.variante_id, -v_d.cantidad,
      case when v_p.tipo = 'mayorista' then 'pedido_mayorista'::public.motivo_movimiento else 'venta'::public.motivo_movimiento end,
      p_pedido, 'Pedido #' || v_p.numero);
  end loop;
  update public.pedidos set estado = 'confirmado', stock_descontado = true where id = p_pedido;
end $$;

create function cancelar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_p record; v_d record;
begin
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.es_admin() or (v_p.mayorista_id = (select auth.uid()) and v_p.estado = 'nuevo')) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_p.estado not in ('nuevo', 'confirmado') then raise exception 'El pedido no se puede cancelar'; end if;
  if v_p.stock_descontado then
    for v_d in select variante_id, cantidad from public.pedidos_detalle where pedido_id = p_pedido order by variante_id loop
      perform public._aplicar_stock(v_d.variante_id, v_d.cantidad, 'anulacion', p_pedido, 'Anulación pedido #' || v_p.numero);
    end loop;
  end if;
  update public.pedidos set estado = 'cancelado', stock_descontado = false where id = p_pedido;
end $$;

create function entregar_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.pedidos set estado = 'entregado' where id = p_pedido and estado = 'confirmado';
  if not found then raise exception 'Solo se entregan pedidos confirmados'; end if;
end $$;

-- Permisos de ejecución
revoke execute on function es_admin(), es_mayorista_aprobado(), obtener_precio_mayorista(uuid, uuid),
  registrar_ingreso_inventario(tipo_ingreso, uuid, int, jsonb, text, text, text, text),
  ajustar_stock(uuid, int, text), confirmar_pedido(uuid), cancelar_pedido(uuid), entregar_pedido(uuid),
  crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) from public, anon;
grant execute on function es_admin(), es_mayorista_aprobado(), obtener_precio_mayorista(uuid, uuid),
  registrar_ingreso_inventario(tipo_ingreso, uuid, int, jsonb, text, text, text, text),
  ajustar_stock(uuid, int, text), confirmar_pedido(uuid), cancelar_pedido(uuid), entregar_pedido(uuid) to authenticated;
grant execute on function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) to anon, authenticated;
revoke execute on function manejar_nuevo_usuario(), proteger_perfil(), sincronizar_tienda_mayorista(), proteger_tienda() from public, anon, authenticated;

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array['perfiles','tiendas','configuracion','marcas','categorias','estilos','tallas','productos',
    'precios_mayorista','imagenes_producto','variantes_producto','precios_especiales_mayorista','precios_tienda',
    'curvas_tallas','curvas_tallas_detalle','ingresos_inventario','ingresos_inventario_detalle',
    'movimientos_inventario','pedidos','pedidos_detalle'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Catálogo simple: lectura pública, escritura solo admin
  foreach t in array array['marcas','categorias','estilos','tallas','imagenes_producto','variantes_producto'] loop
    execute format('create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin inserta" on public.%I for insert to authenticated with check (public.es_admin())', t);
    execute format('create policy "admin actualiza" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t);
    execute format('create policy "admin elimina" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;

  -- Solo admin (lectura y escritura)
  foreach t in array array['curvas_tallas','curvas_tallas_detalle'] loop
    execute format('create policy "admin lee" on public.%I for select to authenticated using (public.es_admin())', t);
    execute format('create policy "admin inserta" on public.%I for insert to authenticated with check (public.es_admin())', t);
    execute format('create policy "admin actualiza" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t);
    execute format('create policy "admin elimina" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;

  -- Solo lectura admin (escritura por funciones)
  foreach t in array array['ingresos_inventario','ingresos_inventario_detalle','movimientos_inventario'] loop
    execute format('create policy "admin lee" on public.%I for select to authenticated using (public.es_admin())', t);
  end loop;
end $$;

-- perfiles
create policy "lee propio o admin" on perfiles for select to authenticated
  using (id = (select auth.uid()) or public.es_admin());
create policy "actualiza propio o admin" on perfiles for update to authenticated
  using (id = (select auth.uid()) or public.es_admin())
  with check (id = (select auth.uid()) or public.es_admin());

-- tiendas
create policy "lectura publica" on tiendas for select to anon using (activa);
create policy "lee activas, propia o admin" on tiendas for select to authenticated
  using (activa or propietario_id = (select auth.uid()) or public.es_admin());
create policy "admin inserta" on tiendas for insert to authenticated with check (public.es_admin());
create policy "dueno o admin actualiza" on tiendas for update to authenticated
  using (propietario_id = (select auth.uid()) or public.es_admin())
  with check (propietario_id = (select auth.uid()) or public.es_admin());
create policy "admin elimina" on tiendas for delete to authenticated using (public.es_admin());

-- configuracion
create policy "lectura publica" on configuracion for select to anon, authenticated using (true);
create policy "admin actualiza" on configuracion for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- productos
create policy "lectura publica" on productos for select to anon using (activo);
create policy "lee activos o admin" on productos for select to authenticated using (activo or public.es_admin());
create policy "admin inserta" on productos for insert to authenticated with check (public.es_admin());
create policy "admin actualiza" on productos for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin elimina" on productos for delete to authenticated using (public.es_admin());

-- precios_mayorista
create policy "mayorista aprobado o admin lee" on precios_mayorista for select to authenticated
  using (public.es_admin() or public.es_mayorista_aprobado());
create policy "admin inserta" on precios_mayorista for insert to authenticated with check (public.es_admin());
create policy "admin actualiza" on precios_mayorista for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin elimina" on precios_mayorista for delete to authenticated using (public.es_admin());

-- precios_especiales_mayorista
create policy "propio o admin lee" on precios_especiales_mayorista for select to authenticated
  using (public.es_admin() or mayorista_id = (select auth.uid()));
create policy "admin inserta" on precios_especiales_mayorista for insert to authenticated with check (public.es_admin());
create policy "admin actualiza" on precios_especiales_mayorista for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin elimina" on precios_especiales_mayorista for delete to authenticated using (public.es_admin());

-- precios_tienda
create policy "lectura publica" on precios_tienda for select to anon, authenticated using (true);
create policy "dueno o admin inserta" on precios_tienda for insert to authenticated
  with check (public.es_admin() or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())));
create policy "dueno o admin actualiza" on precios_tienda for update to authenticated
  using (public.es_admin() or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())))
  with check (public.es_admin() or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())));
create policy "dueno o admin elimina" on precios_tienda for delete to authenticated
  using (public.es_admin() or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())));

-- pedidos (sin inserción directa: se usa crear_pedido)
create policy "admin, mayorista o dueno de tienda lee" on pedidos for select to authenticated
  using (public.es_admin() or mayorista_id = (select auth.uid())
    or exists (select 1 from public.tiendas t where t.id = tienda_id and t.propietario_id = (select auth.uid())));
create policy "lee detalle de pedidos visibles" on pedidos_detalle for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));
