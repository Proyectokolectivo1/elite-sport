import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { mensajeError } from '@/lib/errors'
import { usePageMeta } from '@/lib/meta'
import { registrarMayorista } from '../api/auth'
import { useAuth } from '../hooks/AuthProvider'
import { registroSchema, type RegistroValues } from '../schemas'

const CAMPOS: { name: keyof RegistroValues; label: string; type?: string; auto?: string; ayuda?: string; ancho?: boolean }[] = [
  { name: 'nombre', label: 'Nombre completo', auto: 'name' },
  { name: 'negocio', label: 'Nombre de tu negocio', auto: 'organization' },
  { name: 'cedula_ruc', label: 'Cédula o RUC', auto: 'off' },
  { name: 'telefono', label: 'WhatsApp', type: 'tel', auto: 'tel', ayuda: 'Con código de país y sin signos. Ej. 593991234567' },
  { name: 'ciudad', label: 'Ciudad', auto: 'address-level2' },
  { name: 'email', label: 'Correo', type: 'email', auto: 'email' },
  { name: 'password', label: 'Contraseña', type: 'password', auto: 'new-password' },
  { name: 'confirmar', label: 'Repite la contraseña', type: 'password', auto: 'new-password' },
]

export function RegistroPage() {
  usePageMeta('Registro de mayoristas · Elite Sport', 'Solicita tu cuenta de mayorista: compra a precio mayorista y ten tu propia sección de catálogo.')
  const { session, cargando } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [revisarCorreo, setRevisarCorreo] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroValues>({ resolver: zodResolver(registroSchema) })

  if (!cargando && session) return <Navigate to="/cuenta" replace />

  async function onSubmit(v: RegistroValues) {
    setError(null)
    try {
      const conSesion = await registrarMayorista({ email: v.email, password: v.password, nombre: v.nombre, negocio: v.negocio, cedula_ruc: v.cedula_ruc, telefono: v.telefono, ciudad: v.ciudad })
      if (!conSesion) setRevisarCorreo(true)
    } catch (e) {
      const m = mensajeError(e)
      setError(/already registered/i.test(m) ? 'Ya existe una cuenta con ese correo. Ingresa en lugar de registrarte.' : m)
    }
  }

  if (revisarCorreo) {
    return (
      <main className="grid min-h-dvh place-items-center px-[var(--gutter)]">
        <div className="max-w-md space-y-3">
          <h1 className="text-5xl">Confirma tu correo</h1>
          <p className="text-muted-foreground">Te enviamos un enlace. Al confirmarlo, ingresa y verás el estado de tu solicitud. El administrador la revisará.</p>
          <Link to="/ingresar" className="inline-block underline underline-offset-4">Ir a ingresar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.2fr]">
      <section className="hidden flex-col justify-between bg-brand p-12 text-brand-foreground lg:flex">
        <Logo nombre="Elite Sport" />
        <div className="space-y-5">
          <p className="display-lg max-w-md">Vende calzado sin armar tu propia tienda.</p>
          <p className="max-w-sm text-current/80">Pides al precio mayorista, sin mínimo. Armas tu propia sección con tu logo, tus colores y tu WhatsApp, y fijas tus precios sobre el catálogo que ya está listo.</p>
        </div>
      </section>
      <section className="flex items-center px-[var(--gutter)] py-12">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto w-full max-w-xl space-y-5">
          <div className="lg:hidden"><Logo nombre="Elite Sport" /></div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a la tienda</Link>
          <div>
            <h1 className="text-5xl">Solicita tu cuenta</h1>
            <p className="mt-2 text-sm text-muted-foreground">El administrador revisa cada solicitud antes de activar tu acceso.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <div key={c.name} className={c.name === 'email' || c.name === 'nombre' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={c.name}>{c.label}</Label>
                <Input id={c.name} type={c.type} autoComplete={c.auto} aria-invalid={!!errors[c.name]} {...register(c.name)} />
                {c.ayuda && !errors[c.name] && <p className="mt-1 text-xs text-muted-foreground">{c.ayuda}</p>}
                <FieldError>{errors[c.name]?.message}</FieldError>
              </div>
            ))}
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar solicitud'}</Button>
          <p className="text-sm text-muted-foreground">¿Ya tienes cuenta? <Link to="/ingresar" className="text-foreground underline underline-offset-4">Ingresar</Link></p>
        </form>
      </section>
    </main>
  )
}
