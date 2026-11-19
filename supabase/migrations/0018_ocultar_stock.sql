-- El número de pares en inventario solo lo ve el personal de bodega (admin y bodeguero).
-- La tienda pública, los mayoristas, el vendedor del local y el mayorista del sector solo saben
-- si una talla está disponible. Todos los pedidos validan el stock en el servidor.

-- ============ Disponibilidad pública ============
alter table variantes_producto add column disponible boolean generated always as (stock > 0) stored;

-- El bloqueo de la columna `stock` va en 0019, que se aplica cuando el sitio ya usa `disponible`.

-- ============ Existencias para admin y bodeguero ============
-- Vista con los permisos de su dueño (necesario para leer `stock`), filtrada por rol:
-- a cualquier otro usuario le devuelve cero filas.
create view existencias_variantes with (security_barrier = true) as
  select v.id, v.producto_id, v.color, v.talla_id, v.sku, v.stock
  from public.variantes_producto v
  where public.es_personal_bodega();

revoke all on existencias_variantes from public, anon, authenticated;
grant select on existencias_variantes to authenticated;

-- ============ Búsqueda pública: usa disponibilidad ============
create or replace function buscar_productos(
  p_tienda_id uuid default null,
  p_q text default null,
  p_grupo grupo_talla default null,
  p_marca uuid default null,
  p_estilo uuid default null,
  p_categoria uuid default null,
  p_talla text default null,
  p_min numeric default null,
  p_max numeric default null,
  p_destacado boolean default null,
  p_orden text default 'novedades',
  p_limite int default 12,
  p_desde int default 0
) returns table (id uuid, precio numeric, total bigint)
language sql stable set search_path = '' as $$
  with base as (
    select p.id, p.nombre, p.creado_en, coalesce(pt.precio, p.precio_publico) as precio
    from public.productos p
    left join public.precios_tienda pt on pt.producto_id = p.id and pt.tienda_id = p_tienda_id
    where p.activo
      and (p_grupo is null or p.grupo = p_grupo)
      and (p_marca is null or p.marca_id = p_marca)
      and (p_estilo is null or p.estilo_id = p_estilo)
      and (p_categoria is null or p.categoria_id = p_categoria)
      and (p_destacado is null or p.destacado = p_destacado)
      and (p_min is null or coalesce(pt.precio, p.precio_publico) >= p_min)
      and (p_max is null or coalesce(pt.precio, p.precio_publico) <= p_max)
      and (p_talla is null or exists (
            select 1 from public.variantes_producto v join public.tallas t on t.id = v.talla_id
            where v.producto_id = p.id and t.etiqueta = p_talla and v.disponible))
      and (coalesce(trim(p_q), '') = '' or p.nombre ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%'
           or exists (select 1 from public.marcas m where m.id = p.marca_id
                      and m.nombre ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%'))
  )
  select b.id, b.precio, count(*) over () as total
  from base b
  order by
    case when p_orden = 'precio-asc' then b.precio end asc,
    case when p_orden = 'precio-desc' then b.precio end desc,
    case when p_orden = 'nombre' then b.nombre end asc,
    b.creado_en desc, b.id
  limit least(greatest(p_limite, 1), 48) offset greatest(p_desde, 0)
$$;

-- ============ Pedido a bodega: el error ya no dice cuántos pares hay ============
create or replace function solicitar_a_bodega(p_items jsonb, p_nota text default null) returns jsonb
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
      raise exception 'No hay suficientes pares de % talla %. Pide menos o elige otra talla.', v_v.nombre, v_v.etiqueta;
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
