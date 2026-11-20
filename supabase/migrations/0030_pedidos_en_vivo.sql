-- Pedidos en vivo: las pantallas se enteran al instante de un pedido nuevo o de un cambio de estado.
-- El bodeguero no puede leer la tabla pedidos (vería precios), así que Realtime escucha una tabla aparte,
-- cambios_pedidos, que solo guarda el id, el tipo y el estado de cada pedido. Cada pantalla vuelve a pedir
-- sus datos con sus propios permisos.

create table cambios_pedidos (
  pedido_id uuid primary key references public.pedidos (id) on delete cascade,
  tipo public.tipo_pedido not null,
  estado public.estado_pedido not null,
  cambiado_en timestamptz not null default now()
);

alter table cambios_pedidos enable row level security;

-- Lo leen (y lo escuchan) el admin, el bodeguero, el vendedor y el mayorista del sector. Nadie escribe directo: solo el trigger.
create policy "personal lee cambios de pedidos" on cambios_pedidos
  for select to authenticated
  using (public.es_admin() or public.es_personal_bodega() or public.es_vendedor() or public.es_mayorista_sector());

revoke insert, update, delete, truncate on cambios_pedidos from anon, authenticated;

create function _registrar_cambio_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cambios_pedidos (pedido_id, tipo, estado, cambiado_en)
  values (new.id, new.tipo, new.estado, now())
  on conflict (pedido_id) do update set tipo = excluded.tipo, estado = excluded.estado, cambiado_en = excluded.cambiado_en;
  return null;
end $$;

revoke execute on function _registrar_cambio_pedido() from public, anon, authenticated;

create trigger pedidos_registrar_cambio
  after insert or update on public.pedidos
  for each row execute function _registrar_cambio_pedido();

alter publication supabase_realtime add table cambios_pedidos;
