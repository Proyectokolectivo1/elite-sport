-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('productos', 'productos', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
  ('tiendas', 'tiendas', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "admin gestiona imagenes de productos" on storage.objects for all to authenticated
  using (bucket_id = 'productos' and public.es_admin())
  with check (bucket_id = 'productos' and public.es_admin());

create policy "dueno gestiona su carpeta de tienda" on storage.objects for all to authenticated
  using (bucket_id = 'tiendas' and (public.es_admin() or exists (
    select 1 from public.tiendas t
    where t.id::text = (storage.foldername(name))[1] and t.propietario_id = (select auth.uid()))))
  with check (bucket_id = 'tiendas' and (public.es_admin() or exists (
    select 1 from public.tiendas t
    where t.id::text = (storage.foldername(name))[1] and t.propietario_id = (select auth.uid()))));

-- Semillas
insert into configuracion (id) values (1) on conflict do nothing;

insert into tiendas (slug, nombre, es_principal, plantilla_mensaje)
values ('elite-sport', 'Elite Sport', true, 'Hola Elite Sport, quiero hacer este pedido:');

insert into tallas (grupo, etiqueta, orden)
  select 'dama'::grupo_talla, g::text, g from generate_series(34, 40) g
  union all select 'caballero'::grupo_talla, g::text, g from generate_series(38, 45) g
  union all select 'nino'::grupo_talla, g::text, g from generate_series(22, 33) g;

insert into marcas (nombre, slug) values ('Elite Sport', 'elite-sport'), ('Velocity', 'velocity'), ('Nordik', 'nordik');
insert into categorias (nombre, slug) values ('Running', 'running'), ('Casual', 'casual'), ('Fútbol', 'futbol'), ('Urbano', 'urbano');
insert into estilos (nombre, slug) values ('Deportivo', 'deportivo'), ('Urbano', 'urbano'), ('Clásico', 'clasico');

insert into curvas_tallas (nombre, grupo) values ('Caja dama 12 pares', 'dama'), ('Caja caballero 12 pares', 'caballero');
insert into curvas_tallas_detalle (curva_id, talla_id, pares)
  select c.id, t.id, v.pares
  from (values ('Caja dama 12 pares','dama','35',3), ('Caja dama 12 pares','dama','37',3),
               ('Caja dama 12 pares','dama','38',3), ('Caja dama 12 pares','dama','39',3),
               ('Caja caballero 12 pares','caballero','40',2), ('Caja caballero 12 pares','caballero','41',3),
               ('Caja caballero 12 pares','caballero','42',3), ('Caja caballero 12 pares','caballero','43',2),
               ('Caja caballero 12 pares','caballero','44',2)) as v(curva, grupo, talla, pares)
  join curvas_tallas c on c.nombre = v.curva
  join tallas t on t.grupo = v.grupo::grupo_talla and t.etiqueta = v.talla;

-- Productos de demostración (el admin puede borrarlos)
with p as (
  insert into productos (nombre, slug, marca_id, categoria_id, estilo_id, grupo, descripcion, precio_publico, destacado)
  select v.nombre, v.slug, m.id, c.id, e.id, v.grupo::grupo_talla, 'Producto de demostración.', v.precio, v.destacado
  from (values
    ('Runner Pro Veloz', 'runner-pro-veloz', 'velocity', 'running', 'deportivo', 'caballero', 89.90, true),
    ('Aura Street', 'aura-street', 'elite-sport', 'urbano', 'urbano', 'dama', 74.90, true),
    ('Nordik Trail', 'nordik-trail', 'nordik', 'running', 'deportivo', 'caballero', 99.90, false),
    ('Clásico Court', 'clasico-court', 'elite-sport', 'casual', 'clasico', 'dama', 64.90, false),
    ('Mini Sprint', 'mini-sprint', 'velocity', 'running', 'deportivo', 'nino', 49.90, false)
  ) as v(nombre, slug, marca, categoria, estilo, grupo, precio, destacado)
  join marcas m on m.slug = v.marca
  join categorias c on c.slug = v.categoria
  join estilos e on e.slug = v.estilo
  returning id, slug, precio_publico
)
insert into precios_mayorista (producto_id, precio)
  select id, round(precio_publico * 0.70, 2) from p;
