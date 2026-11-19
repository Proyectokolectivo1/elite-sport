-- Devoluciones despues de una compra. Solo las maneja el admin.
-- Una devolucion toma pares de un pedido ya entregado (tienda, mayorista, mostrador o venta del local),
-- registra el motivo y el monto a devolver, y si el par esta en buen estado lo regresa al inventario
-- por _aplicar_stock (motivo 'devolucion'). El pedido original no se modifica: queda como historial.

create table devoluciones (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  pedido_id uuid not null references pedidos(id) on delete restrict,
  motivo text not null check (motivo in ('talla', 'defecto', 'no_gusto', 'error_pedido', 'otro')),
  reintegrado boolean not null,
  nota text,
  total numeric(12,2) not null check (total >= 0),
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index on devoluciones (pedido_id);
create index on devoluciones (creado_en desc);
create index on devoluciones (creado_por);

create table devoluciones_detalle (
  id uuid primary key default gen_random_uuid(),
  devolucion_id uuid not null references devoluciones(id) on delete cascade,
  detalle_id uuid not null references pedidos_detalle(id) on delete restrict,
  variante_id uuid not null references variantes_producto(id) on delete restrict,
  descripcion text not null,
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);
create index on devoluciones_detalle (devolucion_id);
create index on devoluciones_detalle (detalle_id);
create index on devoluciones_detalle (variante_id);

alter table devoluciones enable row level security;
alter table devoluciones_detalle enable row level security;
create policy "admin lee" on devoluciones for select to authenticated using (public.es_admin());
create policy "admin lee" on devoluciones_detalle for select to authenticated using (public.es_admin());

-- p_lineas: [{"detalle_id": "...", "cantidad": 1}, ...]
create function registrar_devolucion(
  p_pedido uuid, p_lineas jsonb, p_motivo text, p_reintegrar boolean, p_nota text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p record; v_l jsonb; v_d record; v_n int; v_ya int; v_id uuid; v_num bigint; v_total numeric := 0; v_cuantas int := 0;
begin
  if not public.es_admin() then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_motivo not in ('talla', 'defecto', 'no_gusto', 'error_pedido', 'otro') then raise exception 'Motivo no válido'; end if;
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) not between 1 and 100 then
    raise exception 'Indica los pares que se devuelven';
  end if;
  select * into v_p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_p.tipo = 'consignacion' then raise exception 'Las entregas de bodega se cierran desde Bodega'; end if;
  if v_p.estado <> 'entregado' then raise exception 'Solo se devuelven pedidos ya entregados'; end if;

  insert into public.devoluciones (pedido_id, motivo, reintegrado, nota, total, creado_por)
  values (p_pedido, p_motivo, coalesce(p_reintegrar, false), left(nullif(trim(p_nota), ''), 500), 0, (select auth.uid()))
  returning id, numero into v_id, v_num;

  for v_l in select * from jsonb_array_elements(p_lineas) order by (value->>'detalle_id') loop
    v_n := coalesce((v_l->>'cantidad')::int, 0);
    if v_n = 0 then continue; end if;
    select id, variante_id, descripcion, cantidad, precio_unitario into v_d
      from public.pedidos_detalle where id = (v_l->>'detalle_id')::uuid and pedido_id = p_pedido for update;
    if not found then raise exception 'Hay líneas que no son de este pedido'; end if;
    select coalesce(sum(cantidad), 0) into v_ya from public.devoluciones_detalle where detalle_id = v_d.id;
    if v_n < 0 or v_n > v_d.cantidad - v_ya then
      raise exception 'No se pueden devolver % de %: quedan % por devolver', v_n, v_d.descripcion, v_d.cantidad - v_ya;
    end if;
    insert into public.devoluciones_detalle (devolucion_id, detalle_id, variante_id, descripcion, cantidad, precio_unitario)
    values (v_id, v_d.id, v_d.variante_id, v_d.descripcion, v_n, v_d.precio_unitario);
    if p_reintegrar then
      perform public._aplicar_stock(v_d.variante_id, v_n, 'devolucion', v_id, 'Devolución #' || v_num || ' del pedido #' || v_p.numero);
    end if;
    v_total := v_total + v_n * v_d.precio_unitario;
    v_cuantas := v_cuantas + v_n;
  end loop;

  if v_cuantas = 0 then raise exception 'Indica al menos un par'; end if;
  update public.devoluciones set total = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'numero', v_num, 'total', v_total, 'pares', v_cuantas);
end $$;

revoke execute on function registrar_devolucion(uuid, jsonb, text, boolean, text) from public, anon;
grant execute on function registrar_devolucion(uuid, jsonb, text, boolean, text) to authenticated;
