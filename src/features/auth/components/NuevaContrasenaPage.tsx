import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { cambiarContrasena } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'
import { nuevaContrasenaSchema, type NuevaContrasenaValues } from '../schemas'

/** Destino del enlace del correo: Supabase abre una sesión de recuperación y aquí se elige la contraseña nueva. */
export function NuevaContrasenaPage() {
  const { session, cargando } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<NuevaContrasenaValues>({ resolver: zodResolver(nuevaContrasenaSchema) })

  async function onSubmit(v: NuevaContrasenaValues) {
    setError(null)
    try {
      await cambiarContrasena(v.password)
      toast.success('Contraseña actualizada')
      navigate('/cuenta', { replace: true })
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  if (cargando) return <div className="container-page py-16"><Skeleton className="h-40 w-full max-w-sm" /></div>

  return (
    <main className="grid min-h-dvh place-items-center px-[var(--gutter)] py-12">
      <div className="w-full max-w-sm space-y-5">
        <Logo nombre="Elite Sport" />
        {!session ? (
          <div className="space-y-4">
            <h1 className="text-5xl">Enlace no válido</h1>
            <p className="text-muted-foreground">El enlace venció o ya se usó. Pide uno nuevo para crear tu contraseña.</p>
            <Link to="/recuperar" className="inline-flex h-11 items-center rounded-md bg-signal px-5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-signal-foreground">Pedir un enlace nuevo</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <h1 className="text-5xl">Nueva contraseña</h1>
            <div>
              <Label htmlFor="np-password">Contraseña nueva</Label>
              <Input id="np-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
              <FieldError>{errors.password?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="np-confirmar">Repite la contraseña</Label>
              <Input id="np-confirmar" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmar} {...register('confirmar')} />
              <FieldError>{errors.confirmar?.message}</FieldError>
            </div>
            <FieldError>{error ?? undefined}</FieldError>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Guardando…' : 'Guardar contraseña'}</Button>
          </form>
        )}
      </div>
    </main>
  )
}
