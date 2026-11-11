-- Ventas hechas en el punto físico. Va aparte porque un valor nuevo de enum no puede usarse en la misma transacción.
alter type tipo_pedido add value if not exists 'mostrador';
