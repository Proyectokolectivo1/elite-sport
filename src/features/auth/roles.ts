import type { Enums } from '@/types/database'

export type Rol = Enums<'rol_usuario'>
export type EstadoPerfil = Enums<'estado_perfil'>

/** Roles que entran por el panel /admin. */
export const ROLES_PANEL: readonly Rol[] = ['admin', 'bodeguero', 'vendedor']

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  mayorista: 'Mayorista',
  mayorista_sector: 'Mayorista del sector',
  bodeguero: 'Bodeguero',
  vendedor: 'Vendedor del local',
}

/** Pantalla de inicio de cada rol. Sin aprobar, todos van a /cuenta (pantalla de estado). */
export function inicioDeRol(rol: Rol | null | undefined, estado: EstadoPerfil | null | undefined): string {
  if (!rol || estado !== 'aprobado') return '/cuenta'
  switch (rol) {
    case 'admin':
      return '/admin'
    case 'bodeguero':
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
