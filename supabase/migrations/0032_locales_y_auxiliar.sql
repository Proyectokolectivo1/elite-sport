-- Locales (subtiendas) del punto físico y auxiliar de bodega.
--  1. Cada vendedor pertenece a un local (Élite, KZ, Mega Moda...). Cada pedido del vendedor guarda el local con el que
--     se hizo, así la caja y la bodega saben de qué local es aunque luego el vendedor cambie de local.
--  2. El auxiliar de bodega solo mira: lista de pedidos de bodega, conteos y avisos en vivo. Todas las acciones siguen
--     exigiendo es_personal_bodega() (admin o bodeguero), así que no puede despachar, cerrar ni cancelar.

-- ============ Locales ============
create table locales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) between 1 and 60),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index locales_nombre_unico on locales (lower(trim(nombre)));

alter table locales enable row level security;

insert into locales (nombre) values ('Élite'), ('KZ'), ('Mega Moda');

alter table perfiles add column local_id uuid references locales (id) on delete set null;
alter table pedidos add column local_id uuid references locales (id) on delete set null;
create index pedidos_local_idx on pedidos (local_id) where local_id is not null;
create index perfiles_local_idx on perfiles (local_id) where local_id is not null;

-- ============ Ayudantes por rol ============
create function es_auxiliar_bodega() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'auxiliar_bodega' and estado = 'aprobado');
$$;

-- Puede mirar la bodega (sin cambiar nada): admin, bodeguero o auxiliar.
create function puede_ver_bodega() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles
    where id = (select auth.uid()) and rol in ('admin', 'bodeguero', 'auxiliar_bodega') and estado = 'aprobado');
$$;

revoke execute on function es_auxiliar_bodega(), puede_ver_bodega() from public, anon;
grant execute on function es_auxiliar_bodega(), puede_ver_bodega() to authenticated;

-- Locales: los lee el personal; solo el admin los crea o renombra. No se borran (se desactivan) para no perder historia.
create policy "personal lee locales" on locales for select to authenticated
  using (public.es_admin() or public.puede_ver_bodega() or public.es_vendedor());
create policy "admin crea locales" on locales for insert to authenticated with check (public.es_admin());
create policy "admin edita locales" on locales for update to authenticated using (public.es_admin()) with check (public.es_admin());
revoke delete, truncate on locales from anon, authenticated;

-- ============ Perfil: solo el admin cambia rol, estado o local; el local es solo de vendedores ============
create or replace function proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.es_admin()
     and (new.rol <> old.rol or new.estado <> old.estado or new.local_id is distinct from old.local_id) then
    raise exception 'Solo el administrador puede cambiar el rol, el estado o el local' using errcode = '42501';
  end if;
  if new.rol <> 'vendedor' then new.local_id := null; end if;
  return new;
end $$;

-- Al asignar el local a un vendedor, sus pedidos anteriores sin local quedan en ese local.
create function _local_a_pedidos_previos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.local_id is not null then
    update public.pedidos set local_id = new.local_id where solicitante_id = new.id and local_id is null;
  end if;
  return null;
end $$;
revoke execute on function _local_a_pedidos_previos() from public, anon, authenticated;

create trigger perfiles_local_a_pedidos
  after update of local_id on perfiles
  for each row when (new.local_id is distinct from old.local_id)
  execute function _local_a_pedidos_previos();

-- Cada pedido nuevo de un vendedor guarda su local.
create function _asignar_local_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.local_id is null and new.solicitante_id is not null then
    select local_id into new.local_id from public.perfiles where id = new.solicitante_id and rol = 'vendedor';
  end if;
  return new;
end $$;
revoke execute on function _asignar_local_pedido() from public, anon, authenticated;

create trigger pedidos_asignar_local
  before insert on pedidos
  for each row execute function _asignar_local_pedido();

-- Pedidos ya hechos por vendedores que ya tienen local (hoy ninguno, pero por si acaso).
update pedidos p set local_id = pf.local_id
  from perfiles pf where pf.id = p.solicitante_id and pf.rol = 'vendedor' and pf.local_id is not null and p.local_id is null;

-- ============ El auxiliar mira la bodega ============
create or replace view existencias_variantes with (security_barrier = true) as
  select v.id, v.producto_id, v.color, v.talla_id, v.sku, v.stock
  from public.variantes_producto v
  where public.puede_ver_bodega();

drop policy "personal lee cambios de pedidos" on cambios_pedidos;
create policy "personal lee cambios de pedidos" on cambios_pedidos
  for select to authenticated
  using (public.es_admin() or public.puede_ver_bodega() or public.es_vendedor() or public.es_mayorista_sector());

create or replace function contar_pendientes_bodega() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.puede_ver_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  return jsonb_build_object(
    'por_despachar', (select count(*) from public.pedidos where tipo = 'consignacion' and estado = 'nuevo'),
    'en_poder',      (select count(*) from public.pedidos where tipo = 'consignacion' and estado = 'entregado'),
    'web',           (select count(*) from public.pedidos where tipo in ('minorista', 'mayorista') and estado = 'confirmado')
  );
end $$;

-- Igual que antes, más el local del pedido (solicitante_local). Lectura: admin, bodeguero o auxiliar.
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
                      'cantidad_devuelta', d.cantidad_devuelta, 'stock', va.stock) order by d.descripcion), '[]'::jsonb)
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

-- ============ Caja: el punto físico se agrupa por local ============
-- Una fila por local (con los nombres de quienes vendieron en "detalle"). Las ventas sin local van por persona.
create or replace function resumen_ventas(p_desde timestamptz, p_hasta timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_filas jsonb; v_pend jsonb;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Periodo no válido'; end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.canal, f.total desc, f.nombre), '[]'::jsonb) into v_filas from (
    -- Punto físico: una fila por local.
    select 'local'::text as canal, x.clave, x.nombre,
           count(*)::int as pedidos, sum(x.total) as total,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'efectivo'), 0) as efectivo,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'transferencia'), 0) as transferencia,
           coalesce(sum(x.total) filter (where x.metodo_pago = 'tarjeta'), 0) as tarjeta,
           0::numeric as por_cobrar,
           case when x.local_id is not null then string_agg(distinct x.persona, ', ') end as detalle
      from (
        select p.total, p.metodo_pago, l.id as local_id,
               case when l.id is not null then 'local:' || l.id::text else coalesce(p.solicitante_id::text, 'sin-dato') end as clave,
               coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                 || case when pf.rol = 'admin' then ' (admin)' else '' end as persona,
               coalesce('Local ' || l.nombre,
                        coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre')
                          || case when pf.rol = 'admin' then ' (admin)' else '' end) as nombre
          from public.pedidos p
          left join public.perfiles pf on pf.id = p.solicitante_id
          left join public.locales l on l.id = p.local_id
         where p.tipo = 'mostrador' and p.estado = 'entregado'
           and coalesce(p.liquidado_en, p.creado_en) >= p_desde and coalesce(p.liquidado_en, p.creado_en) < p_hasta
      ) x
     group by x.clave, x.nombre, x.local_id
    union all
    -- Sector: cada mayorista, por los cierres de entrega del periodo.
    select 'sector', p.solicitante_id::text,
           coalesce(nullif(trim(pf.negocio), ''), nullif(trim(pf.nombre), ''), 'Sin nombre'),
           count(*) filter (where p.total > 0)::int, coalesce(sum(p.total), 0), 0, 0, 0,
           coalesce(sum(p.total) filter (where p.pagado_en is null), 0), null::text
      from public.pedidos p join public.perfiles pf on pf.id = p.solicitante_id
     where p.tipo = 'consignacion' and p.estado = 'liquidado' and pf.rol = 'mayorista_sector'
       and p.liquidado_en >= p_desde and p.liquidado_en < p_hasta
     group by p.solicitante_id, pf.negocio, pf.nombre
    union all
    -- Tienda web, pedidos por WhatsApp de tiendas de mayoristas y pedidos mayoristas.
    select case p.tipo when 'minorista' then 'web' when 'lead_tienda' then 'whatsapp' else 'mayoristas' end,
           p.tipo::text,
           case p.tipo when 'minorista' then 'Tienda en línea' when 'lead_tienda' then 'Pedidos por WhatsApp' else 'Pedidos de mayoristas' end,
           count(*)::int, sum(p.total), 0, 0, 0, 0, null::text
      from public.pedidos p
     where p.tipo in ('minorista', 'lead_tienda', 'mayorista') and p.estado in ('confirmado', 'entregado')
       and p.creado_en >= p_desde and p.creado_en < p_hasta
     group by p.tipo
  ) f;

  -- Ventas del local que siguen por cerrar (de cualquier fecha): avisan que la caja aún no está completa.
  select jsonb_build_object('pedidos', count(*)::int, 'total', coalesce(sum(total), 0)) into v_pend
    from public.pedidos where tipo = 'mostrador' and estado = 'nuevo';

  return jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'filas', v_filas, 'por_cerrar', v_pend);
end $$;
