-- Pruebas del flujo de bodega por rol (bodeguero, vendedor, mayorista del sector, mayorista normal).
-- Ejecutar en el SQL Editor de Supabase o con `supabase db query`. Todo se revierte al final:
-- el bloque termina con una excepción "REPORTE" (si hay un FALLO, el reporte lo indica).
-- Requiere: un perfil admin aprobado y un producto activo con precio mayorista.

do $$
declare
  v_adm uuid := (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1);
  v_bod uuid := gen_random_uuid();
  v_ven uuid := gen_random_uuid();
  v_ven2 uuid := gen_random_uuid();
  v_sec uuid := gen_random_uuid();
  v_may uuid := gen_random_uuid();
  v_prod uuid := (select p.id from public.productos p join public.precios_mayorista m on m.producto_id = p.id where p.activo limit 1);
  v_var uuid; v_ped_v uuid; v_ped_s uuid; v_ped_c uuid; v_venta_a jsonb; v_venta_b jsonb; v_res jsonb; v_txt text;
  v_det uuid; v_n int; v_num numeric; v_precio numeric;
  ok text := ''; fallos text := '';
  c_adm text; c_bod text; c_ven text; c_ven2 text; c_sec text; c_may text;
begin
  if v_adm is null or v_prod is null then raise exception 'Faltan datos base (admin o producto con precio mayorista)'; end if;
  c_adm := json_build_object('sub', v_adm, 'role', 'authenticated')::text;
  c_bod := json_build_object('sub', v_bod, 'role', 'authenticated')::text;
  c_ven := json_build_object('sub', v_ven, 'role', 'authenticated')::text;
  c_ven2 := json_build_object('sub', v_ven2, 'role', 'authenticated')::text;
  c_sec := json_build_object('sub', v_sec, 'role', 'authenticated')::text;
  c_may := json_build_object('sub', v_may, 'role', 'authenticated')::text;

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, jsonb_build_object('nombre', e, 'negocio', 'Negocio ' || e), now(), now()
  from (values (v_bod, 'bodeguero@t.test'), (v_ven, 'vendedor@t.test'), (v_ven2, 'vendedor2@t.test'),
               (v_sec, 'sector@t.test'), (v_may, 'mayorista@t.test')) as x(u, e);

  -- ================= ADMIN asigna roles =================
  perform set_config('request.jwt.claims', c_adm, true);
  set local role authenticated;
  update public.perfiles set rol = 'bodeguero', estado = 'aprobado' where id = v_bod;
  update public.perfiles set rol = 'vendedor', estado = 'aprobado' where id in (v_ven, v_ven2);
  update public.perfiles set rol = 'mayorista_sector', estado = 'aprobado' where id = v_sec;
  update public.perfiles set estado = 'aprobado' where id = v_may;
  v_precio := public.obtener_precio_mayorista(v_prod, v_sec);
  reset role;

  select count(*) into v_n from public.tiendas where propietario_id = v_sec and activa;
  if v_n = 0 then ok := ok || E'\nmayorista del sector no tiene tienda /t/slug'; else fallos := fallos || E'\nmayorista del sector tiene tienda activa'; end if;
  select count(*) into v_n from public.tiendas where propietario_id = v_may and activa;
  if v_n = 1 then ok := ok || E'\nmayorista normal sí tiene tienda'; else fallos := fallos || E'\nmayorista normal sin tienda'; end if;

  -- ================= BODEGUERO: ingreso y límites =================
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  perform public.registrar_ingreso_inventario('unidad', v_prod, 1,
    (select jsonb_agg(jsonb_build_object('talla_id', t.id, 'total', 10)) from
       (select id from public.tallas where grupo = (select grupo from public.productos where id = v_prod) order by orden limit 1) t),
    'Prueba Bodega');
  ok := ok || E'\nbodeguero registra ingreso';
  select id into v_var from public.variantes_producto where producto_id = v_prod and color = 'Prueba Bodega';
  perform public.ajustar_stock(v_var, 1, 'Conteo');
  perform public.ajustar_stock(v_var, -1, 'Conteo');
  ok := ok || E'\nbodeguero ajusta stock';
  select count(*) into v_n from public.pedidos;
  if v_n = 0 then ok := ok || E'\nbodeguero no lee pedidos (con precios)'; else fallos := fallos || E'\nbodeguero lee pedidos=' || v_n; end if;
  select count(*) into v_n from public.precios_mayorista;
  if v_n = 0 then ok := ok || E'\nbodeguero no ve precio mayorista'; else fallos := fallos || E'\nbodeguero ve precios_mayorista'; end if;
  select count(*) into v_n from public.movimientos_inventario;
  if v_n = 0 then ok := ok || E'\nbodeguero no ve el libro de movimientos'; else fallos := fallos || E'\nbodeguero ve movimientos'; end if;
  select count(*) into v_n from public.curvas_tallas;
  if v_n > 0 then ok := ok || E'\nbodeguero lee curvas de caja'; else fallos := fallos || E'\nbodeguero no lee curvas'; end if;
  begin insert into public.curvas_tallas (nombre, grupo) values ('x', 'dama'); fallos := fallos || E'\nbodeguero creo curva';
  exception when others then ok := ok || E'\nbodeguero no crea curvas'; end;
  begin perform public.confirmar_pedido(gen_random_uuid()); fallos := fallos || E'\nbodeguero confirmo pedido';
  exception when others then ok := ok || E'\nbodeguero no confirma pedidos'; end;
  begin perform public.registrar_venta_mostrador(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
    fallos := fallos || E'\nbodeguero registro venta';
  exception when others then ok := ok || E'\nbodeguero no registra ventas'; end;
  begin update public.variantes_producto set stock = 999 where id = v_var; get diagnostics v_n = row_count;
    if v_n = 0 then ok := ok || E'\nbodeguero no edita stock directo (RLS)'; else fallos := fallos || E'\nbodeguero edito stock directo'; end if;
  exception when others then ok := ok || E'\nbodeguero no edita stock directo'; end;
  begin update public.perfiles set rol = 'admin' where id = v_bod; fallos := fallos || E'\nbodeguero se hizo admin';
  exception when others then ok := ok || E'\nbodeguero no cambia su rol'; end;
  reset role;

  -- ================= MAYORISTA NORMAL no pide a bodega =================
  perform set_config('request.jwt.claims', c_may, true);
  set local role authenticated;
  begin perform public.solicitar_a_bodega(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
    fallos := fallos || E'\nmayorista normal pidio a bodega';
  exception when others then ok := ok || E'\nmayorista normal no pide a bodega'; end;
  reset role;

  -- ================= VENDEDOR pide 5 =================
  perform set_config('request.jwt.claims', c_ven, true);
  set local role authenticated;
  select count(*) into v_n from public.precios_mayorista;
  if v_n = 0 then ok := ok || E'\nvendedor no ve precio mayorista'; else fallos := fallos || E'\nvendedor ve precios_mayorista'; end if;
  begin perform public.solicitar_a_bodega(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 50)));
    fallos := fallos || E'\nvendedor pidio mas que el stock';
  exception when others then ok := ok || E'\nno se pide mas de lo que hay en stock'; end;
  v_ped_v := (public.solicitar_a_bodega(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 5)), 'Para la tarde')->>'id')::uuid;
  select count(*) into v_n from public.pedidos where id = v_ped_v;
  if v_n = 1 then ok := ok || E'\nvendedor ve su pedido a bodega'; else fallos := fallos || E'\nvendedor no ve su pedido'; end if;
  begin perform public.despachar_pedido_bodega(v_ped_v); fallos := fallos || E'\nvendedor se despacho solo';
  exception when others then ok := ok || E'\nvendedor no se despacha solo'; end;
  reset role;

  -- ================= BODEGUERO despacha 4 de 5 =================
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  v_res := public.listar_pedidos_bodega('por_despachar');
  if exists (select 1 from jsonb_array_elements(v_res) e where (e->>'id')::uuid = v_ped_v) then
    ok := ok || E'\nbodeguero ve el pedido por despachar'; else fallos := fallos || E'\nbodeguero no ve el pedido por despachar'; end if;
  v_txt := v_res::text;
  if v_txt not like '%precio%' and v_txt not like '%"total"%' then ok := ok || E'\nla lista de bodega no trae precios ni totales';
  else fallos := fallos || E'\nla lista de bodega trae precios'; end if;
  select (l->>'id')::uuid into v_det from jsonb_array_elements(v_res) e, jsonb_array_elements(e->'lineas') l where (e->>'id')::uuid = v_ped_v;
  begin perform public.despachar_pedido_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'entregados', 6)));
    fallos := fallos || E'\nse entrego mas de lo pedido';
  exception when others then ok := ok || E'\nno se entrega mas de lo pedido'; end;
  perform public.despachar_pedido_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'entregados', 4)));
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 6 then ok := ok || E'\ndespacho de 4: stock 10 -> 6'; else fallos := fallos || E'\nstock tras despacho=' || v_n; end if;
  reset role;

  -- ================= VENDEDOR vende de lo que tiene =================
  perform set_config('request.jwt.claims', c_ven, true);
  set local role authenticated;
  select (e->>'en_poder')::int into v_n from jsonb_array_elements(public.mis_pares_en_poder()) e where (e->>'variante_id')::uuid = v_var;
  if v_n = 4 then ok := ok || E'\nvendedor tiene 4 en su poder'; else fallos := fallos || E'\nen poder=' || coalesce(v_n::text, 'null'); end if;
  v_venta_a := public.registrar_venta_local(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 2)), 'tarjeta', 'Cliente A');
  v_venta_b := public.registrar_venta_local(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)), 'efectivo');
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 6 then ok := ok || E'\nla venta del local no toca el stock central'; else fallos := fallos || E'\nstock tras venta local=' || v_n; end if;
  begin perform public.registrar_venta_local(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 2)));
    fallos := fallos || E'\nvendio mas de lo que tiene';
  exception when others then ok := ok || E'\nno vende mas de lo que tiene en su poder'; end;
  perform public.cancelar_pedido((v_venta_b->>'id')::uuid);
  select (e->>'en_poder')::int into v_n from jsonb_array_elements(public.mis_pares_en_poder()) e where (e->>'variante_id')::uuid = v_var;
  if v_n = 2 then ok := ok || E'\nanular una venta devuelve el par a su poder'; else fallos := fallos || E'\nen poder tras anular=' || coalesce(v_n::text, 'null'); end if;
  reset role;

  -- Otro vendedor no ve nada ajeno ni vende lo que no tiene
  perform set_config('request.jwt.claims', c_ven2, true);
  set local role authenticated;
  select count(*) into v_n from public.pedidos;
  if v_n = 0 then ok := ok || E'\notro vendedor no ve pedidos ajenos'; else fallos := fallos || E'\notro vendedor ve pedidos=' || v_n; end if;
  begin perform public.registrar_venta_local(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
    fallos := fallos || E'\notro vendedor vendio sin tener';
  exception when others then ok := ok || E'\notro vendedor no vende pares ajenos'; end;
  reset role;

  -- ================= BODEGUERO devuelve 1 y cierra =================
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  perform public.devolver_a_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'devueltos', 1)));
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 7 then ok := ok || E'\ndevolucion parcial: stock 6 -> 7'; else fallos := fallos || E'\nstock tras devolucion=' || v_n; end if;
  begin perform public.cerrar_pedido_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'vendidos', 2, 'devueltos', 0)));
    fallos := fallos || E'\ncerro sin cuadrar';
  exception when others then ok := ok || E'\nel cierre no se guarda si no cuadra'; end;
  begin perform public.cerrar_pedido_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'vendidos', 1, 'devueltos', 2)));
    fallos := fallos || E'\ncerro con menos vendidos que los registrados';
  exception when others then ok := ok || E'\nel cierre no baja de lo ya vendido'; end;
  v_res := public.cerrar_pedido_bodega(v_ped_v, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'vendidos', 3, 'devueltos', 0)));
  if v_res->>'venta_sin_registrar' is not null then ok := ok || E'\nel par vendido sin registrar queda como venta aparte';
  else fallos := fallos || E'\nno se creo la venta sin registrar'; end if;
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 7 then ok := ok || E'\ncierre sin devueltos no cambia el stock (7)'; else fallos := fallos || E'\nstock tras cierre=' || v_n; end if;
  reset role;

  perform set_config('request.jwt.claims', c_ven, true);
  set local role authenticated;
  begin perform public.cancelar_pedido((v_venta_a->>'id')::uuid); fallos := fallos || E'\nanulo venta de entrega cerrada';
  exception when others then ok := ok || E'\nno se anula una venta de una entrega ya cerrada'; end;
  reset role;

  -- ================= MAYORISTA DEL SECTOR =================
  perform set_config('request.jwt.claims', c_sec, true);
  set local role authenticated;
  select count(*) into v_n from public.precios_mayorista;
  if v_n > 0 then ok := ok || E'\nmayorista del sector ve su precio mayorista'; else fallos := fallos || E'\nsector no ve precios'; end if;
  v_ped_s := (public.solicitar_a_bodega(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 2)))->>'id')::uuid;
  v_ped_c := (public.solicitar_a_bodega(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)))->>'id')::uuid;
  perform public.cancelar_pedido(v_ped_c);
  ok := ok || E'\nel solicitante cancela su pedido nuevo';
  begin perform public.registrar_venta_local(jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)));
    fallos := fallos || E'\nsector registro venta del local';
  exception when others then ok := ok || E'\nsector no registra ventas del local'; end;
  reset role;

  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  begin perform public.despachar_pedido_bodega(v_ped_c); fallos := fallos || E'\nse despacho un pedido cancelado';
  exception when others then ok := ok || E'\nno se despacha un pedido cancelado'; end;
  perform public.despachar_pedido_bodega(v_ped_s);
  begin perform public.cancelar_pedido(v_ped_s); fallos := fallos || E'\nse cancelo una entrega despachada';
  exception when others then ok := ok || E'\nuna entrega despachada no se cancela'; end;
  select (l->>'id')::uuid into v_det from jsonb_array_elements(public.listar_pedidos_bodega('en_poder')) e, jsonb_array_elements(e->'lineas') l
    where (e->>'id')::uuid = v_ped_s;
  perform public.cerrar_pedido_bodega(v_ped_s, jsonb_build_array(jsonb_build_object('detalle_id', v_det, 'vendidos', 1, 'devueltos', 1)));
  reset role;

  select total into v_num from public.pedidos where id = v_ped_s;
  if v_num = v_precio then ok := ok || E'\nsector liquida 1 par a su precio mayorista'; else fallos := fallos || E'\ntotal sector=' || v_num || ' esperado ' || v_precio; end if;
  select count(*) into v_n from public.pedidos where id = v_ped_v and total = 0 and estado = 'liquidado';
  if v_n = 1 then ok := ok || E'\nla entrega del vendedor queda liquidada con total 0 (sus ventas van aparte)'; else fallos := fallos || E'\nentrega del vendedor mal liquidada'; end if;

  -- ================= Libro de movimientos =================
  select stock into v_n from public.variantes_producto where id = v_var;
  if v_n = 6 then ok := ok || E'\nstock final 6 (10 - 3 vendidos local - 1 vendido sector)'; else fallos := fallos || E'\nstock final=' || v_n; end if;
  select coalesce(sum(delta), 0) into v_n from public.movimientos_inventario where variante_id = v_var;
  if v_n = 6 then ok := ok || E'\nel libro cuadra con el stock'; else fallos := fallos || E'\nlibro suma ' || v_n; end if;
  select count(*) into v_n from public.movimientos_inventario where variante_id = v_var and motivo = 'despacho' and referencia_id = v_ped_v and delta = -4;
  if v_n = 1 then ok := ok || E'\ndespacho trazable en el libro'; else fallos := fallos || E'\nfalta movimiento despacho'; end if;
  select count(*) into v_n from public.movimientos_inventario where variante_id = v_var and motivo = 'devolucion';
  if v_n = 2 then ok := ok || E'\ndevoluciones trazables en el libro'; else fallos := fallos || E'\ndevoluciones en libro=' || v_n; end if;

  -- crear_pedido no crea pedidos de bodega ni de mostrador
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.crear_pedido('consignacion', 'x', '0991234567', jsonb_build_array(jsonb_build_object('variante_id', v_var, 'cantidad', 1)),
      null, null, 'a@b.co', 'Calle 123', '0912345678');
    fallos := fallos || E'\ncrear_pedido acepto consignacion';
  exception when others then ok := ok || E'\ncrear_pedido rechaza consignacion'; end;
  begin perform public.listar_pedidos_bodega('por_despachar'); fallos := fallos || E'\nanon lista bodega';
  exception when others then ok := ok || E'\nanon no lista bodega'; end;
  reset role;

  raise exception E'REPORTE (todo revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos, ''), ' ninguno'), ok;
end $$;
