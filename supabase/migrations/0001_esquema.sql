-- Tipos
create type rol_usuario as enum ('admin','mayorista');
create type estado_perfil as enum ('pendiente','aprobado','rechazado','suspendido');
create type grupo_talla as enum ('dama','caballero','nino');
create type tipo_ingreso as enum ('caja','unidad');
create type tipo_pedido as enum ('minorista','mayorista','lead_tienda');
create type estado_pedido as enum ('nuevo','confirmado','entregado','cancelado');
create type motivo_movimiento as enum ('ingreso','venta','pedido_mayorista','ajuste','anulacion');

-- Usuarios y tiendas
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol rol_usuario not null default 'mayorista',
  estado estado_perfil not null default 'pendiente',
  nombre text not null default '',
  telefono text,
  cedula_ruc text,
  ciudad text,
  negocio text,
  creado_en timestamptz not null default now()
);

create table tiendas (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid unique references perfiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text not null,
  logo_url text,
  banner_url text,
  color_primario text not null default '#0B0B0C' check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  color_acento text not null default '#C8FF2E' check (color_acento ~ '^#[0-9A-Fa-f]{6}$'),
  whatsapp text,
  plantilla_mensaje text not null default 'Hola, quiero hacer este pedido:',
  activa boolean not null default true,
  es_principal boolean not null default false,
  creado_en timestamptz not null default now()
);
create unique index tiendas_una_principal on tiendas (es_principal) where es_principal;

create table configuracion (
  id smallint primary key default 1 check (id = 1),
  nombre_negocio text not null default 'Elite Sport',
  ciudad text not null default 'Guayaquil',
  moneda_codigo text not null default 'USD',
  moneda_simbolo text not null default '$',
  moneda_decimales smallint not null default 2 check (moneda_decimales between 0 and 4),
  locale text not null default 'es-EC',
  whatsapp_principal text,
  actualizado_en timestamptz not null default now()
);

-- Catálogo
create table marcas (id uuid primary key default gen_random_uuid(), nombre text not null unique, slug text not null unique);
create table categorias (id uuid primary key default gen_random_uuid(), nombre text not null unique, slug text not null unique);
create table estilos (id uuid primary key default gen_random_uuid(), nombre text not null unique, slug text not null unique);

create table tallas (
  id uuid primary key default gen_random_uuid(),
  grupo grupo_talla not null,
  etiqueta text not null,
  orden numeric not null,
  unique (grupo, etiqueta)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  marca_id uuid references marcas(id) on delete set null,
  categoria_id uuid references categorias(id) on delete set null,
  estilo_id uuid references estilos(id) on delete set null,
  grupo grupo_talla not null,
  descripcion text,
  precio_publico numeric(10,2) not null check (precio_publico >= 0),
  activo boolean not null default true,
  destacado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index on productos (marca_id);
create index on productos (categoria_id);
create index on productos (estilo_id);

-- El precio mayorista vive aparte para que el público nunca lo lea
create table precios_mayorista (
  producto_id uuid primary key references productos(id) on delete cascade,
  precio numeric(10,2) not null check (precio >= 0)
);

create table imagenes_producto (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  color text not null,
  url text not null,
  orden int not null default 0
);
create index on imagenes_producto (producto_id);

create table variantes_producto (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  color text not null,
  talla_id uuid not null references tallas(id),
  sku text not null unique,
  stock int not null default 0 check (stock >= 0),
  unique (producto_id, color, talla_id)
);
create index on variantes_producto (talla_id);

-- Precios
create table precios_especiales_mayorista (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  mayorista_id uuid not null references perfiles(id) on delete cascade,
  precio numeric(10,2) check (precio >= 0),
  descuento_pct numeric(5,2) check (descuento_pct between 0 and 100),
  check ((precio is not null) <> (descuento_pct is not null)),
  unique (producto_id, mayorista_id)
);
create index on precios_especiales_mayorista (mayorista_id);

create table precios_tienda (
  tienda_id uuid not null references tiendas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  precio numeric(10,2) not null check (precio >= 0),
  primary key (tienda_id, producto_id)
);
create index on precios_tienda (producto_id);

-- Inventario
create table curvas_tallas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  grupo grupo_talla not null
);
create table curvas_tallas_detalle (
  curva_id uuid not null references curvas_tallas(id) on delete cascade,
  talla_id uuid not null references tallas(id),
  pares int not null check (pares > 0),
  primary key (curva_id, talla_id)
);
create index on curvas_tallas_detalle (talla_id);

create table ingresos_inventario (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_ingreso not null,
  num_cajas int not null default 1 check (num_cajas > 0),
  proveedor text,
  referencia text,
  nota text,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index on ingresos_inventario (creado_por);

create table ingresos_inventario_detalle (
  id uuid primary key default gen_random_uuid(),
  ingreso_id uuid not null references ingresos_inventario(id) on delete cascade,
  variante_id uuid not null references variantes_producto(id),
  pares_por_caja int,
  cantidad int not null check (cantidad > 0)
);
create index on ingresos_inventario_detalle (ingreso_id);
create index on ingresos_inventario_detalle (variante_id);

create table movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  variante_id uuid not null references variantes_producto(id),
  delta int not null check (delta <> 0),
  motivo motivo_movimiento not null,
  referencia_id uuid,
  nota text,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index on movimientos_inventario (variante_id, creado_en desc);
create index on movimientos_inventario (creado_por);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  tipo tipo_pedido not null,
  estado estado_pedido not null default 'nuevo',
  tienda_id uuid references tiendas(id) on delete set null,
  mayorista_id uuid references perfiles(id) on delete set null,
  cliente_nombre text not null,
  cliente_telefono text not null,
  nota text,
  total numeric(12,2) not null default 0,
  moneda text not null,
  stock_descontado boolean not null default false,
  creado_en timestamptz not null default now()
);
create index on pedidos (tienda_id);
create index on pedidos (mayorista_id);
create index on pedidos (estado, creado_en desc);

create table pedidos_detalle (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  variante_id uuid not null references variantes_producto(id),
  descripcion text not null,
  cantidad int not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);
create index on pedidos_detalle (pedido_id);
create index on pedidos_detalle (variante_id);
