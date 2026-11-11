-- Pruebas de datos del cliente en pedidos y de ventas en el punto físico. Todo se revierte al final.
-- Requiere: un perfil admin aprobado y un producto activo con precio al público.
do $$
declare
  v_adm uuid := (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1);
  v_mayo uuid := gen_random_uuid();
  v_prod uuid := (select id from public.productos where activo limit 1);
  v_var uuid; v_ped jsonb; v_venta jsonb; v_n int; v_stock int; rec record;
  ok text := ''; fallos text := '';
  c_adm text := json_build_object('sub', (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1), 'role', 'authenticated')::text;
  items jsonb;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_mayo, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'm@t.test',
          '{"nombre":"M","negocio":"Neg M","direccion":"Av. Principal 123"}', now(), now());
  update public.perfiles set estado = 'aprobado' where id = v_mayo;

  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  perform public.registrar_ingreso_inventario('unidad', v_prod, 1,
    (select jsonb_agg(jsonb_build_object('talla_id', t.id, 'total', 10)) from
       (select id from public.tallas where grupo = (select grupo from public.productos where id = v_prod) order by orden limit 1) t), 'Negro');
  reset role;
  select id into v_var from public.variantes_producto where producto_id = v_prod limit 1;
  items := jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1));

  -- la dirección del mayorista llegó desde el registro
  if (select direccion from public.perfiles where id = v_mayo) = 'Av. Principal 123' then ok := ok || E'\nperfil guarda la direccion'; else fallos := fallos || E'\nperfil sin direccion'; end if;

  -- Pedido público: exige correo, dirección y documento
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.crear_pedido('minorista', 'Ana', '0991234567', items, null, null, 'no-es-correo', 'Calle 1 y 2', '0912345678'); fallos := fallos || E'\ncorreo invalido aceptado';
  exception when others then ok := ok || E'\nrechaza correo invalido'; end;
  begin perform public.crear_pedido('minorista', 'Ana', '0991234567', items, null, null, 'ana@t.test', 'x', '0912345678'); fallos := fallos || E'\ndireccion corta aceptada';
  exception when others then ok := ok || E'\nrechaza direccion corta'; end;
  begin perform public.crear_pedido('minorista', 'Ana', '0991234567', items, null, null, 'ana@t.test', 'Calle 1 y 2', '123'); fallos := fallos || E'\ndocumento invalido aceptado';
  exception when others then ok := ok || E'\nrechaza documento invalido'; end;
  v_ped := public.crear_pedido('minorista', 'Ana', '0991234567', items, null, null, ' Ana@T.test ', 'Calle 1 y 2', '0912345678');
  reset role;
  select cliente_correo, cliente_direccion, cliente_documento into rec from public.pedidos where id = (v_ped->>'id')::uuid;
  if rec.cliente_correo = 'ana@t.test' and rec.cliente_direccion = 'Calle 1 y 2' and rec.cliente_documento = '0912345678'
    then ok := ok || E'\npedido guarda correo, direccion y documento'; else fallos := fallos || E'\npedido sin datos del cliente'; end if;

  -- Ventas en el punto físico
  perform set_config('request.jwt.claims', json_build_object('sub', v_mayo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.registrar_venta_mostrador(items); fallos := fallos || E'\nmayorista registro venta de mostrador';
  exception when others then ok := ok || E'\nmayorista no registra ventas de mostrador'; end;
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.registrar_venta_mostrador(items); fallos := fallos || E'\nanonimo registro venta';
  exception when others then ok := ok || E'\nanonimo no registra ventas'; end;
  reset role;

  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  v_venta := public.registrar_venta_mostrador(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 3, 'precio', 50)), 'tarjeta', 'Luis', null, null, '1790012345001');
  reset role;
  select stock into v_stock from public.variantes_producto where id = v_var;
  if v_stock = 7 then ok := ok || E'\nventa de mostrador descuenta el stock (10 a 7)'; else fallos := fallos || E'\nstock tras venta=' || v_stock; end if;
  select estado::text e, tipo::text t, total, metodo_pago, stock_descontado into rec from public.pedidos where id = (v_venta->>'id')::uuid;
  if rec.e = 'entregado' and rec.t = 'mostrador' and rec.total = 150 and rec.metodo_pago = 'tarjeta' and rec.stock_descontado
    then ok := ok || E'\nventa queda entregada, total 150, pago con tarjeta'; else fallos := fallos || E'\nventa mal registrada: ' || rec::text; end if;

  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  begin perform public.registrar_venta_mostrador(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 50))); fallos := fallos || E'\nvendio mas del stock';
  exception when others then ok := ok || E'\nno vende mas de lo que hay'; end;
  perform public.cancelar_pedido((v_venta->>'id')::uuid);
  reset role;
  select stock into v_stock from public.variantes_producto where id = v_var;
  if v_stock = 10 then ok := ok || E'\nanular la venta repone el stock (7 a 10)'; else fallos := fallos || E'\nstock tras anular=' || v_stock; end if;

  raise exception E'REPORTE (todo revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos, ''), ' ninguno'), ok;
end $$;
