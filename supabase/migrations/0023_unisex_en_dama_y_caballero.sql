-- Los productos Unisex también aparecen al filtrar Dama o Caballero (y en sus tarjetas de "Compra por categoría").
-- Unisex sigue teniendo su propio filtro; Niño no incluye unisex.
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
      and (p_grupo is null or p.grupo = p_grupo
           or (p.grupo = 'unisex' and p_grupo in ('dama', 'caballero')))
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
