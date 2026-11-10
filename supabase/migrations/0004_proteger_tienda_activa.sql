-- Un mayorista suspendido o rechazado no puede reactivar su propia tienda:
-- solo el admin (o el sistema, vía trigger de aprobación) cambia `activa`.
create or replace function proteger_tienda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.es_admin()
     and (new.propietario_id is distinct from old.propietario_id
          or new.es_principal <> old.es_principal
          or new.activa <> old.activa) then
    raise exception 'No puedes cambiar el propietario, la tienda principal ni su estado' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function proteger_tienda() from public, anon, authenticated;
