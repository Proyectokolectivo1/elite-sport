import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cerrarSesion } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'

/** Guard de rutas /admin: solo perfiles con rol admin aprobado. */
export function RequireAdmin() {
  const { session, esAdmin, cargando } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div className="container-page space-y-4 py-16">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!session) return <Navigate to="/admin/login" replace state={{ desde: location.pathname }} />
  if (!esAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center px-[var(--gutter)]">
        <div className="max-w-md space-y-4">
          <h1 className="text-5xl">Esta cuenta no es de administración</h1>
          <p className="text-muted-foreground">Ingresa con la cuenta del administrador de Elite Sport.</p>
          <Button variant="solid" onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </Button>
        </div>
      </main>
    )
  }
  return <Outlet />
}
