-- El correo vive en auth.users (no legible desde la app). Se copia al perfil para que el admin lo vea.
alter table perfiles add column correo text;

update perfiles p set correo = u.email from auth.users u where u.id = p.id;

create or replace function manejar_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, telefono, cedula_ruc, ciudad, negocio, correo)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'cedula_ruc',
    new.raw_user_meta_data->>'ciudad',
    new.raw_user_meta_data->>'negocio',
    new.email);
  return new;
end $$;

create function sincronizar_correo_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.perfiles set correo = new.email where id = new.id;
  return new;
end $$;

create trigger al_cambiar_correo after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sincronizar_correo_perfil();

revoke execute on function manejar_nuevo_usuario(), sincronizar_correo_perfil() from public, anon, authenticated;
