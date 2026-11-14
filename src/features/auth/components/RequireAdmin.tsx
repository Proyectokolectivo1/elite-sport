import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cerrarSesion } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'
import { inicioDeRol, puedeEntrar, ROLES_PANEL, type Rol } from '../roles'

interface Props {
  /** Roles aprobados que pueden ver la ruta. */
  roles?: readonly Rol[]
  /** A dónde va quien no tiene sesión. */
  login?: string
}

/**
 * Guard por rol. Sin sesión va al ingreso; con un rol aprobado distinto va a su propia pantalla de inicio.
 * Una cuenta sin rol del panel (pendiente, rechazada) ve el aviso de cuenta no autorizada.
 */
export function RequirePanel({ roles = ROLES_PANEL, login = '/admin/login' }: Props) {
  const { session, perfil, cargando } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div className="container-page space-y-4 py-16">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!session) return <Navigate to={login} replace state={{ desde: location.pathname }} />
  if (puedeEntrar(perfil?.rol, perfil?.estado, roles)) return <Outlet />

  const inicio = inicioDeRol(perfil?.rol, perfil?.estado)
  if (inicio !== '/cuenta' && inicio !== location.pathname) return <Navigate to={inicio} replace />
  return (
    <main className="grid min-h-dvh place-items-center px-[var(--gutter)]">
      <div className="max-w-md space-y-4">
        <h1 className="text-5xl">Esta cuenta no tiene acceso a esta sección</h1>
        <p className="text-muted-foreground">Ingresa con una cuenta de Elite Sport habilitada por el administrador.</p>
        <Button variant="solid" onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </Button>
      </div>
    </main>
  )
}

/** Guard de rutas solo para el administrador. */
export function RequireAdmin() {
  return <RequirePanel roles={['admin']} />
}
