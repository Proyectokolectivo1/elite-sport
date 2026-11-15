-- Consecutivo de pedidos sin saltos.
-- Antes `numero` era una identidad (secuencia): una secuencia no se revierte, así que cada intento
-- fallido o prueba revertida dejaba un hueco (#31, #60, #66...). Ahora el número sale de un contador
-- que se incrementa dentro de la misma transacción del pedido: si el pedido no se guarda, el número
-- tampoco se consume. Un pedido cancelado conserva su número (la trazabilidad no se reutiliza).

create table public.consecutivos (
  clave text primary key,
  ultimo bigint not null default 0
);
alter table public.consecutivos enable row level security;
-- Sin políticas: nadie lo lee ni lo escribe directamente; solo la función de abajo (SECURITY DEFINER).
comment on table public.consecutivos is 'Contadores sin saltos (hoy: pedidos). Solo los usa el trigger asignar_numero_pedido.';

alter table public.pedidos alter column numero drop identity;

-- Renumera lo existente 1..N por orden de creación.
update public.pedidos set numero = numero + 1000000;
with orden as (select id, row_number() over (order by creado_en, numero) as n from public.pedidos)
update public.pedidos p set numero = o.n from orden o where p.id = o.id;
insert into public.consecutivos (clave, ultimo) values ('pedidos', coalesce((select max(numero) from public.pedidos), 0));

create unique index pedidos_numero_key on public.pedidos (numero);

create function public.asignar_numero_pedido() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- El UPDATE bloquea la fila hasta cerrar la transacción: los pedidos simultáneos se numeran de a uno.
  insert into public.consecutivos (clave, ultimo) values ('pedidos', 1)
  on conflict (clave) do update set ultimo = public.consecutivos.ultimo + 1
  returning ultimo into new.numero;
  return new;
end $$;

create trigger pedidos_asignar_numero before insert on public.pedidos
for each row execute function public.asignar_numero_pedido();

revoke execute on function public.asignar_numero_pedido() from public, anon, authenticated;
