import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Logo } from '@/components/layout/Logo'
import { mensajeError } from '@/lib/errors'
import { iniciarSesion } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'
import { loginSchema, type LoginValues } from '../schemas'

interface Props {
  /** Destino si no se llegó desde otra ruta. */
  destinoPorDefecto?: string
  /** Enlace secundario bajo el formulario (ej. registro). */
  pie?: React.ReactNode
}

export function LoginPage({ destinoPorDefecto = '/admin', pie }: Props) {
  const { session, cargando } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const destino = (location.state as { desde?: string } | null)?.desde ?? destinoPorDefecto
  if (!cargando && session) return <Navigate to={destino} replace />

  async function onSubmit(v: LoginValues) {
    setError(null)
    try {
      await iniciarSesion(v.email, v.password)
    } catch (e) {
      setError(mensajeError(e) === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : mensajeError(e))
    }
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand p-12 text-brand-foreground md:flex">
        <Logo nombre="Elite Sport" />
        <p className="display-lg max-w-md">Inventario, precios y pedidos en un solo lugar.</p>
      </section>
      <section className="flex items-center px-[var(--gutter)] py-12">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto w-full max-w-sm space-y-5">
          <div className="md:hidden">
            <Logo nombre="Elite Sport" />
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a la tienda</Link>
          <div>
            <h1 className="text-5xl">Ingresar</h1>
          </div>
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
            <FieldError>{errors.email?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
            <FieldError>{errors.password?.message}</FieldError>
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
          {pie}
        </form>
      </section>
    </main>
  )
}
