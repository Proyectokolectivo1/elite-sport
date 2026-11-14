-- Roles del personal de bodega y del local, y el pedido a bodega que se liquida al cierre.
-- Va aparte porque un valor nuevo de enum no puede usarse en la misma transacción.
alter type rol_usuario add value if not exists 'bodeguero';
alter type rol_usuario add value if not exists 'vendedor';
alter type rol_usuario add value if not exists 'mayorista_sector';

-- Pedido a bodega: los pares salen, quedan en poder del solicitante y se liquidan al cierre.
alter type tipo_pedido add value if not exists 'consignacion';
alter type estado_pedido add value if not exists 'liquidado';

-- Libro de movimientos: salida al solicitante y regreso a bodega.
alter type motivo_movimiento add value if not exists 'despacho';
alter type motivo_movimiento add value if not exists 'devolucion';
