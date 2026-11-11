-- Bloqueo automático de mayoristas que no hacen pedidos al admin en un plazo (por defecto 30 días).
-- Cuenta el último pedido de tipo "mayorista" no cancelado; si no hay ninguno, la fecha de aprobación.
-- Al bloquearlos pasan a "suspendido" con motivo "inactividad": su sección deja de verse y su panel se cierra.
-- El admin los reactiva con "Aprobar", lo que reinicia el plazo.

alter table configuracion
  add column mayorista_dias_inactividad int not null default 30 check (mayorista_dias_inactividad between 7 and 365);

alter table perfiles
  add column aprobado_en timestamptz,
  add column motivo_estado text;

-- Los mayoristas ya aprobados empiezan un plazo nuevo desde hoy.
update perfiles set aprobado_en = now() where rol = 'mayorista' and estado = 'aprobado';

create function marcar_aprobacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado = 'aprobado' and old.estado is distinct from 'aprobado' then
    new.aprobado_en := now();
    new.motivo_estado := null;
  elsif new.estado not in ('suspendido') then
    new.motivo_estado := null;
  end if;
  return new;
end $$;

create trigger marcar_aprobacion before update of estado on perfiles
  for each row when (old.estado is distinct from new.estado)
  execute function public.marcar_aprobacion();

-- Fecha límite de cada mayorista aprobado. El admin ve a todos; un mayorista solo ve la suya.
create function actividad_mayorista(p_id uuid default null)
returns table (mayorista_id uuid, ultimo_pedido timestamptz, vence_en timestamptz)
language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id,
      (select max(o.creado_en) from public.pedidos o
        where o.mayorista_id = p.id and o.tipo = 'mayorista' and o.estado <> 'cancelado') as ultimo,
      coalesce(p.aprobado_en, p.creado_en) as desde
    from public.perfiles p
    where p.rol = 'mayorista' and p.estado = 'aprobado'
      and case when public.es_admin() then (p_id is null or p.id = p_id) else p.id = (select auth.uid()) end
  )
  select id, ultimo,
    greatest(desde, coalesce(ultimo, '-infinity'::timestamptz))
      + make_interval(days => (select mayorista_dias_inactividad from public.configuracion where id = 1))
  from base;
$$;

create function bloquear_mayoristas_inactivos() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.perfiles p set estado = 'suspendido', motivo_estado = 'inactividad'
  where p.rol = 'mayorista' and p.estado = 'aprobado'
    and greatest(
          coalesce(p.aprobado_en, p.creado_en),
          coalesce((select max(o.creado_en) from public.pedidos o
                     where o.mayorista_id = p.id and o.tipo = 'mayorista' and o.estado <> 'cancelado'),
                   '-infinity'::timestamptz))
        < now() - make_interval(days => (select mayorista_dias_inactividad from public.configuracion where id = 1));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function actividad_mayorista(uuid), bloquear_mayoristas_inactivos() from public, anon;
revoke execute on function bloquear_mayoristas_inactivos() from authenticated;
revoke execute on function marcar_aprobacion() from public, anon, authenticated;
grant execute on function actividad_mayorista(uuid) to authenticated;

-- Revisión diaria (04:00 hora de Ecuador = 09:00 UTC).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('bloquear-mayoristas-inactivos', '0 9 * * *', 'select public.bloquear_mayoristas_inactivos()');
