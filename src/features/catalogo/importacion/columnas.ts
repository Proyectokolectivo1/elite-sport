/** Columnas de la hoja "Productos" de la plantilla, en orden. El orden es parte del formato. */
export const COLUMNAS = [
  { clave: 'nombre', titulo: 'Nombre *', ancho: 30 },
  { clave: 'grupo', titulo: 'Grupo *', ancho: 14 },
  { clave: 'marca', titulo: 'Marca', ancho: 20 },
  { clave: 'categoria', titulo: 'Categoría', ancho: 20 },
  { clave: 'estilo', titulo: 'Estilo', ancho: 20 },
  { clave: 'descripcion', titulo: 'Descripción', ancho: 40 },
  { clave: 'precio_publico', titulo: 'Precio público *', ancho: 16 },
  { clave: 'precio_mayorista', titulo: 'Precio mayorista', ancho: 16 },
  { clave: 'talla_desde', titulo: 'Talla desde', ancho: 12 },
  { clave: 'talla_hasta', titulo: 'Talla hasta', ancho: 12 },
  { clave: 'pares', titulo: 'Pares por talla en la caja', ancho: 30 },
  { clave: 'activo', titulo: 'Activo', ancho: 10 },
  { clave: 'destacado', titulo: 'Destacado', ancho: 11 },
] as const

export type ClaveColumna = (typeof COLUMNAS)[number]['clave']
export type FilaCruda = Record<ClaveColumna, string> & { fila: number }

export const HOJA_PRODUCTOS = 'Productos'
export const MAX_FILAS = 500
