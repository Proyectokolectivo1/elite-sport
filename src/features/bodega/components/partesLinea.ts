/** Separa "Producto · Color · talla 40" para destacar la talla; si el texto no tiene ese formato, lo deja entero. */
export function partesLinea(descripcion: string): { nombre: string; color: string | null; talla: string | null } {
  const [nombre, color, talla] = descripcion.split(' · ')
  return talla ? { nombre, color, talla: talla.replace(/^talla\s*/i, '') } : { nombre: descripcion, color: null, talla: null }
}
