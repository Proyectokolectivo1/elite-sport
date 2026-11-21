-- Una pieza de exhibicion cuenta dentro del stock: no se pueden marcar mas pares de exhibicion que el stock de esa talla.
-- Evita ofrecer al vendedor una exhibicion que bodega no podria despachar ("No hay suficientes pares").
create or replace function registrar_exhibicion(p_variante uuid, p_local uuid, p_pieza pieza_exhibicion) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_stock int; v_pares int;
begin
  if not public.es_personal_bodega() then raise exception 'No autorizado' using errcode = '42501'; end if;
  select stock into v_stock from public.variantes_producto where id = p_variante for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  if not exists (select 1 from public.locales where id = p_local and activo) then raise exception 'Ese local no existe o está desactivado'; end if;
  insert into public.exhibiciones (variante_id, local_id, pieza) values (p_variante, p_local, p_pieza) returning id into v_id;

  select count(*) filter (where pieza = 'par') + least(count(*) filter (where pieza = 'derecho'), count(*) filter (where pieza = 'izquierdo'))
    into v_pares from public.exhibiciones where variante_id = p_variante and estado <> 'vendida';
  if v_pares > v_stock then
    raise exception 'El stock de esa talla (% pares) no alcanza para los pares de exhibición (%). Ingresa primero la mercancía.', v_stock, v_pares;
  end if;
  return v_id;
end $$;
