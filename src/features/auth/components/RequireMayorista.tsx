import { Navigate, Outlet } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '../hooks/AuthProvider'

/** Guard de /mayorista: solo mayoristas aprobados. El resto va a /cuenta o a ingresar. */
export function RequireMayorista() {
  const { session, perfil, cargando } = useAuth()
  if (cargando) {
    return (
      <div className="container-page space-y-4 py-16">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!session) return <Navigate to="/ingresar" replace />
  if (perfil?.rol !== 'mayorista' || perfil.estado !== 'aprobado') return <Navigate to="/cuenta" replace />
  return <Outlet />
}
