-- Límite de abuso para crear_pedido (callable por anónimos).
-- Se renombra la función original y se antepone un control por IP y por teléfono.

create table intentos_pedido (
  id bigint generated always as identity primary key,
  ip text not null,
  telefono text not null,
  creado_en timestamptz not null default now()
);
create index on intentos_pedido (ip, creado_en desc);
create index on intentos_pedido (telefono, creado_en desc);
alter table intentos_pedido enable row level security; -- sin políticas: solo la función la usa

alter function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) rename to _crear_pedido;
revoke execute on function _crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) from public, anon, authenticated;

create function crear_pedido(
  p_tipo tipo_pedido, p_cliente_nombre text, p_cliente_telefono text, p_items jsonb,
  p_tienda_id uuid default null, p_nota text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ip text;
  v_tel text := regexp_replace(coalesce(p_cliente_telefono, ''), '[^0-9]', '', 'g');
  v_por_ip int; v_por_tel int;
begin
  -- Los pedidos de mayoristas autenticados no pasan por el límite público.
  if p_tipo <> 'mayorista' then
    v_ip := coalesce(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
    v_ip := coalesce(nullif(trim(v_ip), ''), 'desconocida');

    delete from public.intentos_pedido where creado_en < now() - interval '2 days';
    select count(*) into v_por_ip from public.intentos_pedido where ip = v_ip and creado_en > now() - interval '1 hour';
    select count(*) into v_por_tel from public.intentos_pedido where telefono = v_tel and creado_en > now() - interval '1 hour';
    if v_por_ip >= 15 or v_por_tel >= 6 then
      raise exception 'Demasiados pedidos en poco tiempo. Intenta de nuevo en una hora.' using errcode = 'P0001';
    end if;
    insert into public.intentos_pedido (ip, telefono) values (v_ip, v_tel);
  end if;

  return public._crear_pedido(p_tipo, p_cliente_nombre, p_cliente_telefono, p_items, p_tienda_id, p_nota);
end $$;

revoke execute on function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) from public;
grant execute on function crear_pedido(tipo_pedido, text, text, jsonb, uuid, text) to anon, authenticated;
