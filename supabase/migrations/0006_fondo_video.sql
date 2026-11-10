-- Fondo en movimiento (video que avanza con el scroll), editable por el admin.
alter table configuracion
  add column fondo_activo boolean not null default false,
  add column fondo_video_url text,
  add column fondo_video_movil_url text,
  add column fondo_poster_url text,
  add column fondo_opacidad numeric(3,2) not null default 0.75 check (fondo_opacidad between 0.30 and 0.95);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('medios', 'medios', true, 26214400,
   array['video/mp4','video/webm','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "admin gestiona medios del sitio" on storage.objects for all to authenticated
  using (bucket_id = 'medios' and public.es_admin())
  with check (bucket_id = 'medios' and public.es_admin());
