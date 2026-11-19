-- Tallas y surtido de caja por modelo. Cada producto define su propio rango (ej. 25 a 45 o 36 a 45)
-- y cuántos pares de cada talla trae una caja. Las tallas que no existan en el grupo del producto se crean.
-- El ingreso por caja parte de este surtido.

create table tallas_producto (
  producto_id uuid not null references productos(id) on delete cascade,
  talla_id uuid not null references tallas(id),
  pares_caja int not null default 0 check (pares_caja between 0 and 100),
  primary key (producto_id, talla_id)
);
create index on tallas_producto (talla_id);

alter table tallas_producto enable row level security;
-- Lectura solo del admin (es quien crea productos e ingresa mercancía). La escritura va por la RPC.
create policy "admin lee" on tallas_producto for select to authenticated using (public.es_admin());

-- p_tallas: [{"etiqueta": "38", "pares": 2}, ...] con el rango completo del modelo.
-- pares = pares de esa talla en una caja (0 si la talla existe en el modelo pero no viene en la caja).
create function configurar_tallas_producto(p_producto uuid, p_tallas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_grupo public.grupo_talla; v_e jsonb; v_et text; v_pares int; v_talla uuid;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select grupo into v_grupo from public.productos where id = p_producto;
  if not found then raise exception 'Producto no encontrado'; end if;
  if p_tallas is null or jsonb_typeof(p_tallas) <> 'array' or jsonb_array_length(p_tallas) not between 1 and 40 then
    raise exception 'Indica entre 1 y 40 tallas';
  end if;

  delete from public.tallas_producto where producto_id = p_producto;

  for v_e in select * from jsonb_array_elements(p_tallas) loop
    v_et := trim(coalesce(v_e->>'etiqueta', ''));
    if v_et !~ '^[0-9]{1,2}(\.5)?$' then raise exception 'Talla no válida: %', v_et; end if;
    v_pares := coalesce((v_e->>'pares')::int, 0);
    if v_pares not between 0 and 100 then raise exception 'Pares por caja no válidos en la talla %', v_et; end if;

    select id into v_talla from public.tallas where grupo = v_grupo and etiqueta = v_et;
    if not found then
      insert into public.tallas (grupo, etiqueta, orden) values (v_grupo, v_et, v_et::numeric) returning id into v_talla;
    end if;
    insert into public.tallas_producto (producto_id, talla_id, pares_caja) values (p_producto, v_talla, v_pares)
    on conflict (producto_id, talla_id) do update set pares_caja = excluded.pares_caja;
  end loop;
end $$;

revoke execute on function configurar_tallas_producto(uuid, jsonb) from public, anon;
grant execute on function configurar_tallas_producto(uuid, jsonb) to authenticated;
