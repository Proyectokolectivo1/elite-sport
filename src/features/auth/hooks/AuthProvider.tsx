import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { obtenerPerfil, obtenerSesion, suscribirSesion, type Perfil } from '../api/auth'

interface AuthValue {
  session: Session | null
  perfil: Perfil | null
  /** true mientras se resuelve la sesión y el perfil. */
  cargando: boolean
  esAdmin: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sesionLista, setSesionLista] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerSesion()
      .then((s) => activo && setSession(s))
      .catch(() => undefined)
      .finally(() => activo && setSesionLista(true))
    const baja = suscribirSesion((s) => setSession(s))
    return () => {
      activo = false
      baja()
    }
  }, [])

  const userId = session?.user.id
  const perfilQuery = useQuery({
    queryKey: ['perfil', userId],
    queryFn: () => obtenerPerfil(userId as string),
    enabled: !!userId,
  })

  const value = useMemo<AuthValue>(() => {
    const perfil = perfilQuery.data ?? null
    return {
      session,
      perfil,
      cargando: !sesionLista || (!!userId && perfilQuery.isLoading),
      esAdmin: perfil?.rol === 'admin' && perfil.estado === 'aprobado',
    }
  }, [session, sesionLista, userId, perfilQuery.data, perfilQuery.isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
