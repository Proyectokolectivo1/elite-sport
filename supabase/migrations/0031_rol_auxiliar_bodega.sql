-- Rol nuevo: auxiliar de bodega. Ve los pedidos y el movimiento de bodega para avisar al bodeguero; no cambia nada.
-- Va solo en su propia migración: un valor nuevo de enum no se puede usar en la misma transacción que lo crea.
alter type rol_usuario add value if not exists 'auxiliar_bodega';
