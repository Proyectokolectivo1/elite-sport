-- Pruebas de tallas y surtido por modelo. Todo se revierte: el bloque termina con una excepcion "REPORTE".
-- Requiere: un admin aprobado y un producto de caballero (un bodeguero aprobado es opcional).
do $$
declare
  v_adm uuid := (select id from public.perfiles where rol = 'admin' and estado = 'aprobado' limit 1);
  v_bod uuid := (select id from public.perfiles where rol = 'bodeguero' and estado = 'aprobado' limit 1);
  v_prod uuid := (select id from public.productos where grupo = 'caballero' limit 1);
  v_n int; v_ing uuid; ok text := ''; fallos text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.configurar_tallas_producto(v_prod,
    (select jsonb_agg(jsonb_build_object('etiqueta', g::text, 'pares', case when g between 38 and 42 then 2 else 0 end)) from generate_series(25, 45) g));
  select count(*) into v_n from public.tallas_producto where producto_id = v_prod;
  if v_n = 21 then ok := ok || E'\nadmin guarda rango 25-45 (21 tallas)'; else fallos := fallos || E'\nrango guardado=' || v_n; end if;
  select coalesce(sum(pares_caja), 0) into v_n from public.tallas_producto where producto_id = v_prod;
  if v_n = 10 then ok := ok || E'\nsurtido: 10 pares por caja'; else fallos := fallos || E'\npares caja=' || v_n; end if;
  perform public.configurar_tallas_producto(v_prod,
    (select jsonb_agg(jsonb_build_object('etiqueta', g::text, 'pares', 1)) from generate_series(36, 45) g));
  select count(*) into v_n from public.tallas_producto where producto_id = v_prod;
  if v_n = 10 then ok := ok || E'\nreconfigurar a 36-45 reemplaza (10 tallas)'; else fallos := fallos || E'\nreemplazo=' || v_n; end if;
  v_ing := public.registrar_ingreso_inventario('caja', v_prod, 1,
    (select jsonb_agg(jsonb_build_object('talla_id', tp.talla_id, 'pares', tp.pares_caja)) from public.tallas_producto tp where tp.producto_id = v_prod), 'PruebaRango');
  select count(*) into v_n from public.ingresos_inventario_detalle where ingreso_id = v_ing;
  if v_n = 10 then ok := ok || E'\ningreso por caja con el surtido del modelo (10 tallas, incluida la 36)'; else fallos := fallos || E'\nlineas ingreso=' || v_n; end if;
  begin perform public.configurar_tallas_producto(v_prod, '[{"etiqueta":"abc","pares":1}]'); fallos := fallos || E'\nacepto talla no valida';
  exception when others then ok := ok || E'\nrechaza talla no valida'; end;
  begin perform public.configurar_tallas_producto(v_prod, '[{"etiqueta":"40","pares":500}]'); fallos := fallos || E'\nacepto 500 pares';
  exception when others then ok := ok || E'\nrechaza pares fuera de rango'; end;
  reset role;

  if v_bod is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_bod, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin perform public.configurar_tallas_producto(v_prod, '[{"etiqueta":"40","pares":1}]'); fallos := fallos || E'\nbodeguero configuro tallas';
    exception when others then ok := ok || E'\nbodeguero no configura tallas'; end;
    select count(*) into v_n from public.tallas_producto;
    if v_n = 0 then ok := ok || E'\nbodeguero no lee el surtido'; else fallos := fallos || E'\nbodeguero lee surtido'; end if;
    reset role;
  end if;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.configurar_tallas_producto(v_prod, '[{"etiqueta":"40","pares":1}]'); fallos := fallos || E'\nanon configuro';
  exception when others then ok := ok || E'\nanon no configura'; end;
  reset role;

  raise exception E'REPORTE (todo revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos, ''), ' ninguno'), ok;
end $$;
