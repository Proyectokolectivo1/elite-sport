-- Categoría Unisex junto a Dama, Caballero y Niño. Sus tallas se crean al configurar cada modelo
-- (configurar_tallas_producto), con el rango que defina el admin.
alter type grupo_talla add value if not exists 'unisex';
