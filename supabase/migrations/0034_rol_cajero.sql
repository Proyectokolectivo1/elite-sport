-- Rol nuevo: cajero. Ve la caja y las ventas por tienda y vendedor (solo lectura). Va solo: un valor nuevo de enum no se puede usar en la misma transacción.
alter type rol_usuario add value if not exists 'cajero';
