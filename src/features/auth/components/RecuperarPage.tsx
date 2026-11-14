import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { mensajeError } from '@/lib/errors'
import { solicitarRecuperacion } from '../api/auth'
import { recuperarSchema, type RecuperarValues } from '../schemas'

/** Pide el correo y envía el enlace. La respuesta es la misma exista o no la cuenta. */
export function RecuperarPage() {
  const [enviado, setEnviado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecuperarValues>({ resolver: zodResolver(recuperarSchema) })

  async function onSubmit(v: RecuperarValues) {
    setError(null)
    try {
      await solicitarRecuperacion(v.email)
      setEnviado(v.email.trim())
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-[var(--gutter)] py-12">
      <div className="w-full max-w-sm space-y-5">
        <Logo nombre="Elite Sport" />
        <Link to="/ingresar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a ingresar</Link>
        <h1 className="text-5xl">Recuperar contraseña</h1>
        {enviado ? (
          <div role="status" className="space-y-3">
            <p>Si <strong>{enviado}</strong> tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</p>
            <p className="text-sm text-muted-foreground">El enlace vence pronto. Si no llega en unos minutos, vuelve a pedirlo.</p>
            <Button variant="outline" onClick={() => setEnviado(null)}>Usar otro correo</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <p className="text-muted-foreground">Escribe el correo con el que te registraste y te enviamos un enlace para crear una contraseña nueva.</p>
            <div>
              <Label htmlFor="rec-email">Correo</Label>
              <Input id="rec-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <FieldError>{error ?? undefined}</FieldError>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Enviando…' : 'Enviar enlace'}</Button>
          </form>
        )}
      </div>
    </main>
  )
}
