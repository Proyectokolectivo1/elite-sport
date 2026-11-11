export interface LineaMensaje {
  descripcion: string
  cantidad: number
  precio: number
}

interface Entrada {
  plantilla: string
  numero: number
  nombre: string
  telefono: string
  correo?: string
  direccion?: string
  documento?: string
  nota: string
  lineas: LineaMensaje[]
  total: number
  formato: (n: number) => string
}

/** Mensaje de pedido: la plantilla de la tienda, el detalle, el total y los datos del cliente. */
export function construirMensaje(e: Entrada): string {
  const detalle = e.lineas.map((l) => `${l.cantidad} × ${l.descripcion}: ${e.formato(l.precio * l.cantidad)}`)
  return [
    e.plantilla.trim(),
    '',
    `Pedido #${e.numero}`,
    ...detalle,
    '',
    `Total: ${e.formato(e.total)}`,
    '',
    `Cliente: ${e.nombre}`,
    ...(e.documento ? [`Cédula o RUC: ${e.documento}`] : []),
    `Celular: ${e.telefono}`,
    ...(e.correo ? [`Correo: ${e.correo}`] : []),
    ...(e.direccion ? [`Dirección: ${e.direccion}`] : []),
    ...(e.nota.trim() ? [`Nota: ${e.nota.trim()}`] : []),
  ].join('\n')
}

/** Deja solo dígitos; wa.me no admite +, espacios ni guiones. */
export function soloDigitos(telefono: string): string {
  return telefono.replace(/\D/g, '')
}

export function urlWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${soloDigitos(telefono)}?text=${encodeURIComponent(mensaje)}`
}
