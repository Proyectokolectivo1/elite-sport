-- Pruebas de seguridad por rol (anónimo, mayorista pendiente, mayorista aprobado, admin).
-- Ejecutar en el SQL Editor de Supabase o con `supabase db query`. Todo se revierte al final:
-- el bloque termina con una excepción "REPORTE" (si hay un FALLO, el reporte lo indica).
-- Requiere: un perfil admin aprobado y el producto de demostración 'runner-pro-veloz' (o cualquier producto activo con precio mayorista).

do $$
declare
  v_adm uuid := (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1);
  v_pen uuid := gen_random_uuid();
  v_apr uuid := gen_random_uuid();
  v_otro uuid := gen_random_uuid();
  v_prod uuid := (select p.id from public.productos p join public.precios_mayorista m on m.producto_id = p.id where p.activo limit 1);
  v_var uuid; v_tienda_apr uuid; v_tienda_otro uuid; v_n int; v_ped jsonb;
  ok text := ''; fallos text := '';
  c_adm text; c_pen text; c_apr text;

begin
  if v_adm is null or v_prod is null then raise exception 'Faltan datos base (admin o producto con precio mayorista)'; end if;
  c_adm := json_build_object('sub', v_adm, 'role', 'authenticated')::text;
  c_pen := json_build_object('sub', v_pen, 'role', 'authenticated')::text;
  c_apr := json_build_object('sub', v_apr, 'role', 'authenticated')::text;

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, jsonb_build_object('nombre', e, 'negocio', 'Negocio ' || e), now(), now()
  from (values (v_pen, 'pendiente@t.test'), (v_apr, 'aprobado@t.test'), (v_otro, 'otro@t.test')) as x(u, e);

  -- Admin aprueba a dos mayoristas e ingresa stock
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set estado = 'aprobado' where id in (v_apr, v_otro);
  perform public.registrar_ingreso_inventario('unidad', v_prod, 1,
    (select jsonb_agg(jsonb_build_object('talla_id', t.id, 'total', 10)) from
       (select id from public.tallas where grupo = (select grupo from public.productos where id = v_prod) order by orden limit 1) t), 'Negro');
  reset role;
  select id into v_var from public.variantes_producto where producto_id = v_prod limit 1;
  select id into v_tienda_apr from public.tiendas where propietario_id = v_apr;
  select id into v_tienda_otro from public.tiendas where propietario_id = v_otro;

  -- ================= ANÓNIMO =================
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  select count(*) into v_n from public.precios_mayorista;
  if v_n = 0 then ok := ok || E'\nanon no ve precios mayoristas'; else fallos := fallos || E'\nanon ve precios_mayorista=' || v_n; end if;
  select count(*) into v_n from public.productos;
  if v_n > 0 then ok := ok || E'\nanon ve catalogo'; else fallos := fallos || E'\nanon no ve catalogo'; end if;
  select count(*) into v_n from public.pedidos;
  if v_n = 0 then ok := ok || E'\nanon no ve pedidos'; else fallos := fallos || E'\nanon ve pedidos'; end if;
  select count(*) into v_n from public.perfiles;
  if v_n = 0 then ok := ok || E'\nanon no ve perfiles'; else fallos := fallos || E'\nanon ve perfiles'; end if;
  select count(*) into v_n from public.movimientos_inventario;
  if v_n = 0 then ok := ok || E'\nanon no ve movimientos'; else fallos := fallos || E'\nanon ve movimientos'; end if;
  begin insert into public.productos (nombre, slug, grupo, precio_publico) values ('x', 'x-anon', 'dama', 1); fallos := fallos || E'\nanon creo producto';
  exception when others then ok := ok || E'\nanon no crea productos'; end;
  begin perform public.registrar_ingreso_inventario('unidad', v_prod, 1, '[]'::jsonb, 'x'); fallos := fallos || E'\nanon ingreso inventario';
  exception when others then ok := ok || E'\nanon no ingresa inventario'; end;
  begin perform public.confirmar_pedido(gen_random_uuid()); fallos := fallos || E'\nanon confirmo pedido';
  exception when others then ok := ok || E'\nanon no confirma pedidos'; end;
  begin select count(*) into v_n from public.intentos_pedido;
    if v_n = 0 then ok := ok || E'\nanon no ve intentos_pedido (RLS sin politicas)'; else fallos := fallos || E'\nanon lee intentos_pedido=' || v_n; end if;
  exception when others then ok := ok || E'\nanon no lee intentos_pedido'; end;
  reset role;

  -- ================= MAYORISTA PENDIENTE =================
  perform set_config('request.jwt.claims', c_pen, true);
  set local role authenticated;
  select count(*) into v_n from public.precios_mayorista;
  if v_n = 0 then ok := ok || E'\npendiente no ve precios mayoristas'; else fallos := fallos || E'\npendiente ve precios'; end if;
  begin update public.perfiles set rol = 'admin', estado = 'aprobado' where id = v_pen; fallos := fallos || E'\npendiente se autoaprobo';
  exception when others then ok := ok || E'\npendiente no se autoaprueba'; end;
  begin perform public.crear_pedido('mayorista', 'x', '0991234567', jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
    fallos := fallos || E'\npendiente hizo pedido mayorista';
  exception when others then ok := ok || E'\npendiente no hace pedido mayorista'; end;
  reset role;

  -- ================= MAYORISTA APROBADO =================
  perform set_config('request.jwt.claims', c_apr, true);
  set local role authenticated;
  select count(*) into v_n from public.precios_mayorista;
  if v_n > 0 then ok := ok || E'\naprobado ve precios mayoristas'; else fallos := fallos || E'\naprobado no ve precios'; end if;
  begin insert into public.productos (nombre, slug, grupo, precio_publico) values ('x', 'x-apr', 'dama', 1); fallos := fallos || E'\naprobado creo producto';
  exception when others then ok := ok || E'\naprobado no crea productos'; end;
  update public.productos set precio_publico = 1 where id = v_prod; get diagnostics v_n = row_count;
  if v_n = 0 then ok := ok || E'\naprobado no edita productos'; else fallos := fallos || E'\naprobado edito producto'; end if;
  update public.precios_mayorista set precio = 1 where producto_id = v_prod; get diagnostics v_n = row_count;
  if v_n = 0 then ok := ok || E'\naprobado no edita precio mayorista'; else fallos := fallos || E'\naprobado edito precio mayorista'; end if;
  begin insert into public.precios_tienda (tienda_id, producto_id, precio) values (v_tienda_otro, v_prod, 5); fallos := fallos || E'\naprobado fijo precio en tienda ajena';
  exception when others then ok := ok || E'\naprobado no fija precios en tienda ajena'; end;
  update public.tiendas set nombre = 'hack' where id = v_tienda_otro; get diagnostics v_n = row_count;
  if v_n = 0 then ok := ok || E'\naprobado no edita tienda ajena'; else fallos := fallos || E'\naprobado edito tienda ajena'; end if;
  insert into public.precios_tienda (tienda_id, producto_id, precio) values (v_tienda_apr, v_prod, 120);
  ok := ok || E'\naprobado fija precio en su tienda';
  begin update public.variantes_producto set stock = 999 where id = v_var; get diagnostics v_n = row_count;
    if v_n = 0 then ok := ok || E'\naprobado no edita stock (RLS)'; else fallos := fallos || E'\naprobado edito stock'; end if;
  exception when others then ok := ok || E'\naprobado no edita stock'; end;
  begin perform public.ajustar_stock(v_var, 5, 'hack'); fallos := fallos || E'\naprobado ajusto stock';
  exception when others then ok := ok || E'\naprobado no ajusta stock'; end;
  begin perform public.registrar_ingreso_inventario('unidad', v_prod, 1, '[]'::jsonb, 'x'); fallos := fallos || E'\naprobado ingreso inventario';
  exception when others then ok := ok || E'\naprobado no ingresa inventario'; end;
  begin update public.tiendas set activa = false where id = v_tienda_apr;
    fallos := fallos || E'\naprobado cambio activa';
  exception when others then ok := ok || E'\naprobado no cambia activa'; end;
  v_ped := public.crear_pedido('mayorista', 'Aprobado', '0991234567', jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
  ok := ok || E'\naprobado crea pedido mayorista';
  begin perform public.confirmar_pedido((v_ped->>'id')::uuid); fallos := fallos || E'\naprobado confirmo su pedido';
  exception when others then ok := ok || E'\naprobado no confirma pedidos'; end;
  reset role;

  -- Mayorista "otro" no ve el pedido ni los leads del aprobado
  perform set_config('request.jwt.claims', json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.pedidos;
  if v_n = 0 then ok := ok || E'\notro mayorista no ve pedidos ajenos'; else fallos := fallos || E'\notro ve pedidos ajenos=' || v_n; end if;
  reset role;

  -- ================= LÍMITE DE ABUSO (anónimo) =================
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
  set local role anon;
  v_n := 0;
  begin
    for i in 1..8 loop
      perform public.crear_pedido('lead_tienda', 'Spam', '0990000000', jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)), v_tienda_apr);
      v_n := i;
    end loop;
    fallos := fallos || E'\nlimite por telefono no actuo';
  exception when others then
    if v_n = 6 then ok := ok || E'\nlimite: el pedido 7 del mismo telefono se rechaza'; else fallos := fallos || E'\nlimite actuo en el pedido ' || (v_n + 1) || ': ' || sqlerrm; end if;
  end;
  reset role;

  -- ================= ADMIN =================
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  begin update public.variantes_producto set stock = 999 where id = v_var; fallos := fallos || E'\nadmin hizo UPDATE directo de stock';
  exception when others then ok := ok || E'\nnadie (ni admin) hace UPDATE directo de stock'; end;
  perform public.confirmar_pedido((v_ped->>'id')::uuid);
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 9 then ok := ok || E'\nadmin confirma y el stock baja de 10 a 9'; else fallos := fallos || E'\nstock tras confirmar=' || v_n; end if;
  reset role;

  raise exception E'REPORTE (todo revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos, ''), ' ninguno'), ok;
end $$;
