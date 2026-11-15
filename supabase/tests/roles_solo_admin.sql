-- El rol lo define solo el administrador de Elite Sport, y el bodeguero trabaja solo con la bodega y la tienda principal.
-- Todo se revierte: el bloque termina con una excepcion "REPORTE".
-- Requiere: un perfil admin aprobado y un producto activo.
do $$
declare
  v_adm uuid := (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1);
  v_bod uuid := gen_random_uuid();
  v_may uuid := gen_random_uuid();
  v_otro uuid := gen_random_uuid();
  v_nuevo uuid := gen_random_uuid();
  v_ven uuid := gen_random_uuid();
  v_mmay uuid := gen_random_uuid();
  v_prod uuid := (select id from public.productos where activo limit 1);
  v_var uuid; v_lead uuid; v_min uuid; v_n int; v_res jsonb;
  c_adm text; c_bod text; c_may text; c_ven text;
  ok text := ''; fallos text := '';
begin
  if v_adm is null or v_prod is null then raise exception 'Faltan datos base'; end if;
  c_adm := json_build_object('sub', v_adm, 'role', 'authenticated')::text;
  c_bod := json_build_object('sub', v_bod, 'role', 'authenticated')::text;
  c_may := json_build_object('sub', v_may, 'role', 'authenticated')::text;
  c_ven := json_build_object('sub', v_ven, 'role', 'authenticated')::text;

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, jsonb_build_object('nombre', e, 'negocio', 'Negocio ' || e), now(), now()
  from (values (v_bod, 'bod@t.test'), (v_may, 'may@t.test'), (v_otro, 'otro@t.test'), (v_ven, 'ven@t.test'), (v_mmay, 'mmay@t.test')) as x(u, e);
  -- Alguien que intenta registrarse ya con rol de administrador en los datos del alta.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_nuevo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'intruso@t.test',
          jsonb_build_object('nombre', 'Intruso', 'rol', 'admin', 'estado', 'aprobado'), now(), now());
  select count(*) into v_n from public.perfiles where id = v_nuevo and rol = 'mayorista' and estado = 'pendiente';
  if v_n = 1 then ok := ok || E'\nel alta no puede traer un rol: queda mayorista pendiente'; else fallos := fallos || E'\nel alta definio su propio rol'; end if;

  -- El admin aprueba un mayorista (nace su tienda) y luego lo pasa a bodeguero.
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set estado = 'aprobado' where id = v_may;
  reset role;
  select count(*) into v_n from public.tiendas where propietario_id = v_may and activa;
  if v_n = 1 then ok := ok || E'\nel mayorista aprobado tiene su tienda'; else fallos := fallos || E'\nmayorista sin tienda'; end if;

  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set rol = 'bodeguero' where id = v_may;
  reset role;
  select count(*) into v_n from public.tiendas where propietario_id = v_may and activa;
  if v_n = 0 then ok := ok || E'\nal pasar a bodeguero su tienda de mayorista deja de estar activa'; else fallos := fallos || E'\nel bodeguero conserva tienda activa'; end if;

  update public.perfiles set rol = 'bodeguero', estado = 'aprobado' where id = v_bod;

  -- Nadie mas que el admin cambia roles (ni el propio, ni el de otros).
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  begin update public.perfiles set rol = 'admin' where id = v_bod; fallos := fallos || E'\nel bodeguero se hizo admin';
  exception when others then ok := ok || E'\nel bodeguero no cambia su propio rol'; end;
  update public.perfiles set rol = 'vendedor' where id = v_otro;
  get diagnostics v_n = row_count;
  if v_n = 0 then ok := ok || E'\nel bodeguero no toca el perfil de otra persona'; else fallos := fallos || E'\nel bodeguero edito otro perfil'; end if;
  select count(*) into v_n from public.perfiles where id <> v_bod;
  if v_n = 0 then ok := ok || E'\nel bodeguero no ve los perfiles de los demas'; else fallos := fallos || E'\nel bodeguero ve perfiles ajenos=' || v_n; end if;
  reset role;

  -- Pedidos de las tiendas de mayoristas (lead_tienda): el bodeguero ni los ve ni los entrega.
  insert into public.pedidos (tipo, estado, cliente_nombre, cliente_telefono, moneda, total)
    values ('lead_tienda', 'confirmado', 'Cliente de tienda mayorista', '0990000001', 'USD', 10) returning id into v_lead;
  insert into public.pedidos (tipo, estado, cliente_nombre, cliente_telefono, moneda, total)
    values ('minorista', 'confirmado', 'Cliente web', '0990000002', 'USD', 10) returning id into v_min;
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  v_res := public.listar_pedidos_bodega('web');
  if exists (select 1 from jsonb_array_elements(v_res) e where (e->>'id')::uuid = v_min) then ok := ok || E'\nel bodeguero ve los pedidos de la tienda principal';
  else fallos := fallos || E'\nel bodeguero no ve pedidos de la tienda principal'; end if;
  if exists (select 1 from jsonb_array_elements(v_res) e where (e->>'id')::uuid = v_lead) then fallos := fallos || E'\nel bodeguero ve pedidos de tiendas de mayoristas';
  else ok := ok || E'\nel bodeguero no ve pedidos de tiendas de mayoristas'; end if;
  begin perform public.entregar_pedido(v_lead); fallos := fallos || E'\nel bodeguero entrego un pedido de tienda de mayorista';
  exception when others then ok := ok || E'\nel bodeguero no entrega pedidos de tiendas de mayoristas'; end;
  begin perform public.cancelar_pedido(v_min); fallos := fallos || E'\nel bodeguero cancelo un pedido web';
  exception when others then ok := ok || E'\nel bodeguero no cancela pedidos web'; end;
  reset role;

  -- ================= VENDEDOR DEL LOCAL: mismas reglas =================
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set estado = 'aprobado' where id = v_mmay;
  reset role;
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set rol = 'vendedor' where id = v_mmay;
  reset role;
  select count(*) into v_n from public.tiendas where propietario_id = v_mmay and activa;
  if v_n = 0 then ok := ok || E'
al pasar a vendedor su tienda de mayorista deja de estar activa'; else fallos := fallos || E'
el vendedor conserva tienda activa'; end if;

  update public.perfiles set rol = 'vendedor', estado = 'aprobado' where id = v_ven;
  perform set_config('request.jwt.claims', c_ven, true);
  set local role authenticated;
  begin update public.perfiles set rol = 'admin' where id = v_ven; fallos := fallos || E'
el vendedor se hizo admin';
  exception when others then ok := ok || E'
el vendedor no cambia su propio rol'; end;
  begin update public.perfiles set rol = 'bodeguero' where id = v_ven; fallos := fallos || E'
el vendedor se hizo bodeguero';
  exception when others then ok := ok || E'
el vendedor no se asigna otro rol'; end;
  update public.perfiles set rol = 'vendedor' where id = v_otro;
  get diagnostics v_n = row_count;
  if v_n = 0 then ok := ok || E'
el vendedor no toca el perfil de otra persona'; else fallos := fallos || E'
el vendedor edito otro perfil'; end if;
  select count(*) into v_n from public.perfiles where id <> v_ven;
  if v_n = 0 then ok := ok || E'
el vendedor no ve los perfiles de los demas'; else fallos := fallos || E'
el vendedor ve perfiles ajenos=' || v_n; end if;
  select count(*) into v_n from public.pedidos where id in (v_lead, v_min);
  if v_n = 0 then ok := ok || E'
el vendedor no ve pedidos web ni de tiendas de mayoristas'; else fallos := fallos || E'
el vendedor ve pedidos ajenos=' || v_n; end if;
  begin perform public.entregar_pedido(v_min); fallos := fallos || E'
el vendedor entrego un pedido web';
  exception when others then ok := ok || E'
el vendedor no entrega pedidos web'; end;
  begin perform public.cancelar_pedido(v_lead); fallos := fallos || E'
el vendedor cancelo un pedido de tienda de mayorista';
  exception when others then ok := ok || E'
el vendedor no cancela pedidos de tiendas de mayoristas'; end;
  begin perform public.listar_pedidos_bodega('web'); fallos := fallos || E'
el vendedor lista pedidos de bodega';
  exception when others then ok := ok || E'
el vendedor no usa la vista de bodega'; end;
  reset role;

  raise exception E'REPORTE (todo revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos, ''), ' ninguno'), ok;
end $$;
