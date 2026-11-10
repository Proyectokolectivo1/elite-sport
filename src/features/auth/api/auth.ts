import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Perfil = Tables<'perfiles'>

export async function iniciarSesion(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export interface DatosRegistro {
  email: string
  password: string
  nombre: string
  negocio: string
  cedula_ruc: string
  telefono: string
  ciudad: string
}

/** Crea la cuenta; un trigger genera el perfil en estado "pendiente". Devuelve true si ya hay sesión (sin confirmar correo). */
export async function registrarMayorista({ email, password, ...datos }: DatosRegistro): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: datos } })
  if (error) throw error
  return !!data.session
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function obtenerSesion(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function suscribirSesion(cb: (s: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, s) => cb(s))
  return () => data.subscription.unsubscribe()
}

export async function obtenerPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}
