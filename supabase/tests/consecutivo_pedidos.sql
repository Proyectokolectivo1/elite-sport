-- El numero de pedido es consecutivo y no deja huecos, ni siquiera tras un intento fallido.
-- Todo se revierte: el bloque termina con una excepcion "REPORTE".
do $$
declare v_a bigint; v_b bigint; v_c bigint; v_ult bigint; v_ok text := '';
begin
  select ultimo into v_ult from public.consecutivos where clave = 'pedidos';
  insert into public.pedidos (tipo, estado, cliente_nombre, cliente_telefono, moneda, total) values ('mostrador', 'nuevo', 'T1', '0990000000', 'USD', 0) returning numero into v_a;
  begin
    insert into public.pedidos (tipo, estado, cliente_nombre, cliente_telefono, moneda, total) values ('mostrador', 'nuevo', 'T2', '0990000000', 'USD', 0) returning numero into v_b;
    raise exception 'fallo a proposito';
  exception when others then null; end;
  insert into public.pedidos (tipo, estado, cliente_nombre, cliente_telefono, moneda, total) values ('mostrador', 'nuevo', 'T3', '0990000000', 'USD', 0) returning numero into v_c;
  if v_a = v_ult + 1 then v_ok := v_ok || 'primero consecutivo; '; else v_ok := v_ok || 'FALLO primero ' || v_a || ' esperado ' || (v_ult + 1) || '; '; end if;
  if v_c = v_a + 1 then v_ok := v_ok || 'tras un intento fallido no hay hueco'; else v_ok := v_ok || 'FALLO hueco: ' || v_a || ' -> ' || v_c; end if;
  raise exception 'REPORTE (revertido): %', v_ok;
end $$;
