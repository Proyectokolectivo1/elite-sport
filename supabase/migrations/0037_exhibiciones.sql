-- Pares de exhibicion repartidos por local.
-- Cada pieza (par completo, pie derecho o pie izquierdo) esta en el local donde se exhibe y cuenta dentro del stock de bodega.
-- El vendedor la vende con un pedido a bodega marcado: el bodeguero ve de que local sale y no la busca en bodega.
-- Un par armado es un derecho y un izquierdo de la misma variante, aunque esten en locales distintos.

create type pieza_exhibicion as enum ('par', 'derecho', 'izquierdo');

create table exhibiciones (
  id uuid primary key default gen_random_uuid(),
  variante_id uuid not null references variantes_producto(id) on delete cascade,
  local_id uuid not null references locales(id),
  pieza pieza_exhibicion not null,
  estado text not null default 'en_exhibicion' check (estado in ('en_exhibicion', 'reservada', 'vendida')),
  pedido_detalle_id uuid references pedidos_detalle(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index exhibiciones_variante_idx on exhibiciones (variante_id) where estado <> 'vendida';
create index exhibiciones_detalle_idx on exhibiciones (pedido_detalle_id);

alter table exhibiciones enable row level security;
create policy exhibiciones_lectura on exhibiciones for select to authenticated using (public.puede_ver_bodega());
revoke all on exhibiciones from anon, authenticated;
grant select on exhibiciones to authenticated;

-- ============ Alta y baja (admin y bodeguero) ============
create function registrar_exhibicion(p_variante uuid, p_local uuid, p_pieza pieza_exhibicion) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if not exists (select 1 from public.variantes_producto where id = p_variante) then raise exception 'Producto no encontrado'; end if;
  if not exists (select 1 from public.locales where id = p_local and activo) then raise exception 'Ese local no existe o está desactivado'; end if;
  insert into public.exhibiciones (variante_id, local_id, pieza) values (p_variante, p_local, p_pieza) returning id into v_id;
  return v_id;
end $$;

create function quitar_exhibicion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e record;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_e from public.exhibiciones where id = p_id for update;
  if not found then raise exception 'No encontramos esa pieza'; end if;
  if v_e.estado = 'reservada' then raise exception 'Está en un pedido a bodega abierto: ciérralo o cancélalo primero'; end if;
  delete from public.exhibiciones where id = p_id;
end $$;

-- ============ Lectura ============
-- Admin, bodeguero y auxiliar: todas las piezas con su local y, si estan reservadas, el pedido.
create function listar_exhibiciones() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb;
begin
  if not public.puede_ver_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(f order by f->>'producto', f->>'color', f->>'talla', f->>'pieza'), '[]'::jsonb) into v_res from (
    select jsonb_build_object(
      'id', x.id, 'variante_id', x.variante_id, 'producto_id', p.id, 'producto', p.nombre, 'color', va.color,
      'talla', t.etiqueta, 'local_id', l.id, 'local', l.nombre, 'pieza', x.pieza, 'estado', x.estado,
      'pedido_numero', pe.numero) as f
    from public.exhibiciones x
    join public.variantes_producto va on va.id = x.variante_id
    join public.productos p on p.id = va.producto_id
    join public.tallas t on t.id = va.talla_id
    join public.locales l on l.id = x.local_id
    left join public.pedidos_detalle d on d.id = x.pedido_detalle_id
    left join public.pedidos pe on pe.id = d.pedido_id
    where x.estado <> 'vendida'
  ) q;
  return v_res;
end $$;

-- Vendedor: solo donde esta cada pieza disponible (sin stock ni cantidades de bodega).
create function exhibiciones_para_vendedor() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb; v_local uuid;
begin
  if not public.es_vendedor() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select local_id into v_local from public.perfiles where id = (select auth.uid());
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'variante_id', x.variante_id, 'pieza', x.pieza, 'local_id', l.id, 'local', l.nombre,
      'propia', (l.id is not distinct from v_local)) order by x.pieza, l.nombre), '[]'::jsonb) into v_res
    from public.exhibiciones x join public.locales l on l.id = x.local_id
   where x.estado = 'en_exhibicion';
  return v_res;
end $$;

revoke execute on function registrar_exhibicion(uuid, uuid, pieza_exhibicion), quitar_exhibicion(uuid),
  listar_exhibiciones(), exhibiciones_para_vendedor() from public, anon;
grant execute on function registrar_exhibicion(uuid, uuid, pieza_exhibicion), quitar_exhibicion(uuid),
  listar_exhibiciones(), exhibiciones_para_vendedor() to authenticated;

-- ============ Al cerrar o cancelar el pedido, la pieza se vende o vuelve a la exhibicion ============
create function _liberar_exhibiciones() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.exhibiciones x
     set estado = case when new.estado = 'liquidado' and d.cantidad_vendida > 0 then 'vendida' else 'en_exhibicion' end,
         pedido_detalle_id = case when new.estado = 'liquidado' and d.cantidad_vendida > 0 then x.pedido_detalle_id else null end
    from public.pedidos_detalle d
   where x.pedido_detalle_id = d.id and d.pedido_id = new.id and x.estado = 'reservada';
  return new;
end $$;
revoke execute on function _liberar_exhibiciones() from public, anon, authenticated;

create trigger pedidos_liberar_exhibiciones after update of estado on pedidos
  for each row when (new.estado in ('liquidado', 'cancelado') and old.estado is distinct from new.estado)
  execute function _liberar_exhibiciones();

-- ============ Pedido a bodega: lineas de exhibicion ============
-- Un item con "exhibicion": [ids] vende esa pieza: un id de par completo, o dos ids (derecho + izquierdo) de la misma variante.
create or replace function solicitar_a_bodega(p_items jsonb, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_sector boolean; v_perfil record; v_moneda text;
  v_id uuid; v_num bigint; v_it record; v_v record; v_precio numeric; v_e jsonb; v_p numeric;
  v_ids uuid[]; v_pz text[]; v_c int; v_det uuid; v_var uuid;
begin
  v_sector := public.es_mayorista_sector();
  if not (v_sector or public.es_vendedor()) then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'El pedido no tiene productos';
  end if;
  for v_e in select e from jsonb_array_elements(p_items) e loop
    if (v_e->>'cantidad')::int is null or (v_e->>'cantidad')::int not between 1 and 1000 then
      raise exception 'Cantidad inválida';
    end if;
    if v_e ? 'precio' and jsonb_typeof(v_e->'precio') <> 'null' then
      v_p := (v_e->>'precio')::numeric;
      if v_p < 0 or v_p > 1000000 then raise exception 'Precio inválido'; end if;
    end if;
    if jsonb_typeof(v_e->'exhibicion') = 'array' and v_sector then
      raise exception 'Las piezas de exhibición se piden desde un local';
    end if;
  end loop;

  -- Hay stock para la suma de todas las lineas de cada talla (la exhibicion cuenta como un par).
  for v_it in
    select (e->>'variante_id')::uuid as variante_id,
           sum(case when jsonb_typeof(e->'exhibicion') = 'array' then 1 else (e->>'cantidad')::int end)::int as cantidad
      from jsonb_array_elements(p_items) e group by 1
  loop
    select va.stock, p.nombre, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_it.variante_id;
    if not found then raise exception 'Producto no disponible'; end if;
    if v_v.stock < v_it.cantidad then
      raise exception 'No hay suficientes pares de % talla %. Pide menos o elige otra talla.', v_v.nombre, v_v.etiqueta;
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

  -- Lineas normales: se agrupan por talla y precio.
  for v_it in
    select (e->>'variante_id')::uuid as variante_id, sum((e->>'cantidad')::int)::int as cantidad,
           case when not v_sector and e ? 'precio' and jsonb_typeof(e->'precio') <> 'null'
                then round((e->>'precio')::numeric, 2) end as precio
      from jsonb_array_elements(p_items) e
     where jsonb_typeof(e->'exhibicion') is distinct from 'array'
     group by 1, 3 order by 1, 3
  loop
    select va.id, va.color, p.id as producto_id, p.nombre, p.precio_publico, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_it.variante_id;
    if v_sector then
      v_precio := public.obtener_precio_mayorista(v_v.producto_id, v_uid);
      if v_precio is null then raise exception 'El producto % no tiene precio mayorista', v_v.nombre; end if;
    else
      v_precio := coalesce(v_it.precio, v_v.precio_publico);
    end if;
    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, precio_lista)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta, v_it.cantidad, v_precio,
            case when v_sector then null else v_v.precio_publico end);
  end loop;

  -- Lineas de exhibicion: una por pieza o par armado, con su propio detalle.
  for v_e in select e from jsonb_array_elements(p_items) e where jsonb_typeof(e->'exhibicion') = 'array' loop
    v_var := (v_e->>'variante_id')::uuid;
    select array_agg(j::uuid) into v_ids from jsonb_array_elements_text(v_e->'exhibicion') j;
    if v_ids is null or array_length(v_ids, 1) not in (1, 2)
       or (select count(distinct i) from unnest(v_ids) i) <> array_length(v_ids, 1) then
      raise exception 'La pieza de exhibición no es válida';
    end if;
    perform 1 from public.exhibiciones where id = any(v_ids) order by id for update;
    select count(*), array_agg(pieza::text order by pieza::text) into v_c, v_pz
      from public.exhibiciones where id = any(v_ids) and variante_id = v_var and estado = 'en_exhibicion';
    if v_c <> array_length(v_ids, 1) then
      raise exception 'Esa pieza de exhibición ya no está disponible. Actualiza la pantalla.';
    end if;
    if not (v_pz = array['par'] or v_pz = array['derecho', 'izquierdo']) then
      raise exception 'Un par de exhibición es un par completo o un derecho con un izquierdo';
    end if;
    select va.id, va.color, p.nombre, p.precio_publico, t.etiqueta into v_v
      from public.variantes_producto va
      join public.productos p on p.id = va.producto_id
      join public.tallas t on t.id = va.talla_id
      where va.id = v_var;
    v_precio := coalesce(case when v_e ? 'precio' and jsonb_typeof(v_e->'precio') <> 'null' then round((v_e->>'precio')::numeric, 2) end,
                         v_v.precio_publico);
    insert into public.pedidos_detalle (pedido_id, variante_id, descripcion, cantidad, precio_unitario, precio_lista)
    values (v_id, v_v.id, v_v.nombre || ' · ' || v_v.color || ' · talla ' || v_v.etiqueta || ' (exhibición)', 1, v_precio, v_v.precio_publico)
    returning id into v_det;
    update public.exhibiciones set estado = 'reservada', pedido_detalle_id = v_det where id = any(v_ids);
  end loop;

  return jsonb_build_object('id', v_id, 'numero', v_num);
end $$;

-- ============ Bodega: cada linea dice de que local sale la exhibicion ============
create or replace function listar_pedidos_bodega(p_vista text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_res jsonb;
begin
  if not public.puede_ver_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
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
        'solicitante_local', l.nombre,
        'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono,
        'cliente_direccion', p.cliente_direccion,
        'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', d.id, 'variante_id', d.variante_id, 'descripcion', d.descripcion, 'cantidad', d.cantidad,
                      'cantidad_entregada', d.cantidad_entregada, 'cantidad_vendida', d.cantidad_vendida,
                      'cantidad_devuelta', d.cantidad_devuelta, 'stock', va.stock,
                      'exhibicion', (select coalesce(jsonb_agg(jsonb_build_object('pieza', x.pieza, 'local', lx.nombre) order by x.pieza), '[]'::jsonb)
                                       from public.exhibiciones x join public.locales lx on lx.id = x.local_id
                                      where x.pedido_detalle_id = d.id)) order by d.descripcion), '[]'::jsonb)
                   from public.pedidos_detalle d join public.variantes_producto va on va.id = d.variante_id
                   where d.pedido_id = p.id)
      ) as fila
    from public.pedidos p
    left join public.perfiles s on s.id = p.solicitante_id
    left join public.locales l on l.id = p.local_id
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
