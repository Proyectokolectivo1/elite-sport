import { Navigate } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cerrarSesion } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'

const MENSAJES = {
  pendiente: { titulo: 'Tu solicitud está en revisión', texto: 'El administrador la revisará pronto. Cuando la apruebe, esta pantalla te llevará a tu panel de mayorista.' },
  rechazado: { titulo: 'Tu solicitud no fue aprobada', texto: 'Si crees que es un error, comunícate con Elite Sport por WhatsApp.' },
  suspendido: { titulo: 'Tu cuenta está suspendida', texto: 'Tu sección de tienda está desactivada. Comunícate con Elite Sport para reactivarla.' },
} as const

/** Pantalla de estado: dirige cada perfil a su sitio. */
export function CuentaPage() {
  const { session, perfil, cargando } = useAuth()
  if (cargando) return <div className="container-page py-16"><Skeleton className="h-40 w-full max-w-md" /></div>
  if (!session) return <Navigate to="/ingresar" replace />
  if (perfil?.rol === 'admin' && perfil.estado === 'aprobado') return <Navigate to="/admin" replace />
  if (perfil?.rol === 'mayorista' && perfil.estado === 'aprobado') return <Navigate to="/mayorista" replace />

  const m = MENSAJES[perfil?.estado === 'rechazado' || perfil?.estado === 'suspendido' ? perfil.estado : 'pendiente']
  return (
    <main className="grid min-h-dvh place-items-center px-[var(--gutter)]">
      <div className="max-w-md space-y-4">
        <Logo nombre="Elite Sport" />
        <p className="eyebrow pt-6">Tu cuenta</p>
        <h1 className="text-5xl">{m.titulo}</h1>
        <p className="text-muted-foreground">{m.texto}</p>
        <Button variant="outline" onClick={() => void cerrarSesion()}>Cerrar sesión</Button>
      </div>
    </main>
  )
}
