import type { Enums } from '@/types/database'

export type Rol = Enums<'rol_usuario'>
export type EstadoPerfil = Enums<'estado_perfil'>

/** Roles que entran por el panel /admin. */
export const ROLES_PANEL: readonly Rol[] = ['admin', 'cajero', 'bodeguero', 'auxiliar_bodega', 'vendedor']

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  mayorista: 'Mayorista',
  mayorista_sector: 'Mayorista del sector',
  bodeguero: 'Bodeguero',
  auxiliar_bodega: 'Auxiliar de bodega',
  cajero: 'Cajero',
  vendedor: 'Vendedor del local',
}

/** Pantalla de inicio de cada rol. Sin aprobar, todos van a /cuenta (pantalla de estado). */
export function inicioDeRol(rol: Rol | null | undefined, estado: EstadoPerfil | null | undefined): string {
  if (!rol || estado !== 'aprobado') return '/cuenta'
  switch (rol) {
    case 'admin':
      return '/admin'
    case 'cajero':
      return '/admin/caja'
    case 'bodeguero':
    case 'auxiliar_bodega':
      return '/admin/bodega'
    case 'vendedor':
      return '/admin/local'
    case 'mayorista':
      return '/mayorista'
    case 'mayorista_sector':
      return '/sector'
  }
}

export function puedeEntrar(rol: Rol | null | undefined, estado: EstadoPerfil | null | undefined, roles: readonly Rol[]): boolean {
  return !!rol && estado === 'aprobado' && roles.includes(rol)
}

/** Cómo se nombra a una persona del equipo: el vendedor lleva su local (Vendedor · KZ). */
export function etiquetaRol(rol: Rol, local?: string | null): string {
  return rol === 'vendedor' && local ? `${NOMBRE_ROL.vendedor} · ${local}` : NOMBRE_ROL[rol]
}
