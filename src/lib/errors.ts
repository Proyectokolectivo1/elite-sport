/** Extrae un mensaje legible de cualquier error (los de Supabase no son instancias de Error). */
export function mensajeError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return 'Ocurrió un error inesperado'
}
