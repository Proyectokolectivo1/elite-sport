-- contar_pendientes_bodega: el bodeguero recibe solo tres conteos; vendedor y anonimos no la pueden usar.
-- Todo se revierte con una excepcion "REPORTE". Requiere un perfil admin aprobado.
do $$
declare v_bod uuid := gen_random_uuid(); v_ven uuid := gen_random_uuid(); v_adm uuid := (select id from public.perfiles where rol='admin' and estado='aprobado' limit 1);
  c_bod text; c_ven text; v_res jsonb; ok text := ''; fallos text := '';
begin
  c_bod := json_build_object('sub', v_bod, 'role', 'authenticated')::text;
  c_ven := json_build_object('sub', v_ven, 'role', 'authenticated')::text;
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', e, jsonb_build_object('nombre', e), now(), now()
  from (values (v_bod, 'bod@t.test'), (v_ven, 'ven@t.test')) as x(u, e);
  perform set_config('request.jwt.claims', json_build_object('sub', v_adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.perfiles set rol='bodeguero', estado='aprobado' where id = v_bod;
  update public.perfiles set rol='vendedor', estado='aprobado' where id = v_ven;
  reset role;
  perform set_config('request.jwt.claims', c_bod, true);
  set local role authenticated;
  v_res := public.contar_pendientes_bodega();
  if v_res ? 'por_despachar' and v_res ? 'web' and v_res ? 'en_poder' then ok := ok || E'\nel bodeguero recibe los tres conteos'; else fallos := fallos || E'\nconteo incompleto'; end if;
  if v_res::text not like '%precio%' and v_res::text not like '%total%' then ok := ok || E'\nel conteo no trae precios ni totales'; else fallos := fallos || E'\nel conteo trae precios'; end if;
  reset role;
  perform set_config('request.jwt.claims', c_ven, true);
  set local role authenticated;
  begin perform public.contar_pendientes_bodega(); fallos := fallos || E'\nel vendedor uso el conteo'; exception when others then ok := ok || E'\nel vendedor no usa el conteo de bodega'; end;
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin perform public.contar_pendientes_bodega(); fallos := fallos || E'\nanon uso el conteo'; exception when others then ok := ok || E'\nanon no usa el conteo'; end;
  reset role;
  raise exception E'REPORTE (revertido)\nFALLOS: %\nOK: %', coalesce(nullif(fallos,''),' ninguno'), ok;
end $$;
