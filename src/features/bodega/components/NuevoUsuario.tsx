import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { NOMBRE_ROL } from '@/features/auth/roles'
import { mensajeError } from '@/lib/errors'
import { useCambiarContrasena, useCrearUsuario, useEliminarUsuario } from '../hooks/useBodega'
import { SelectorLocal } from './Locales'
import {
  generarContrasena,
  nuevaContrasenaUsuarioSchema,
  nuevoUsuarioSchema,
  type NuevaContrasenaUsuarioValues,
  type NuevoUsuarioValues,
} from '../schemas'

const ROLES: NuevoUsuarioValues['rol'][] = ['vendedor', 'bodeguero', 'auxiliar_bodega', 'cajero', 'mayorista_sector', 'mayorista']

/** Copia texto y confirma en el propio boton (sin ventanas emergentes). */
function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [listo, setListo] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setListo(true)
          window.setTimeout(() => setListo(false), 1800)
        })
      }}
    >
      {listo ? <Check /> : <Copy />} {listo ? 'Copiado' : etiqueta}
    </Button>
  )
}

/** Credenciales para entregar a la persona. Se muestran una sola vez. */
function Credenciales({ correo, contrasena, rol, onListo }: { correo: string; contrasena: string; rol: string; onListo: () => void }) {
  const url = `${window.location.origin}/ingresar`
  const mensaje = `Tu acceso a Elite Sport (${rol}):\nIngresa en ${url}\nCorreo: ${correo}\nContraseña temporal: ${contrasena}\nPuedes cambiarla desde "¿Olvidaste tu contraseña?".`
  return (
    <div className="space-y-4" role="status">
      <p className="rounded-md bg-success/10 p-3 text-sm">Cuenta creada y aprobada. Entrégale estos datos: la contraseña no se vuelve a mostrar.</p>
      <dl className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm">
        <div><dt className="eyebrow">Ingreso</dt><dd className="break-all">{url}</dd></div>
        <div><dt className="eyebrow">Correo</dt><dd className="break-all">{correo}</dd></div>
        <div><dt className="eyebrow">Contraseña temporal</dt><dd className="font-mono text-base">{contrasena}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Copiar texto={mensaje} etiqueta="Copiar mensaje completo" />
        <Button type="button" onClick={onListo}>Listo</Button>
      </div>
    </div>
  )
}

/** Formulario de alta: el admin crea la cuenta ya aprobada y con su rol. */
export function NuevoUsuario({ onListo }: { onListo: () => void }) {
  const crear = useCrearUsuario()
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState<{ correo: string; contrasena: string; rol: string } | null>(null)
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<NuevoUsuarioValues>({
    resolver: zodResolver(nuevoUsuarioSchema),
    defaultValues: { nombre: '', correo: '', contrasena: generarContrasena(), rol: 'vendedor', local_id: '', negocio: '', telefono: '', cedula_ruc: '', ciudad: '' },
  })

  const rol = useWatch({ control, name: 'rol' })
  if (creado) return <Credenciales {...creado} onListo={onListo} />

  function onSubmit(v: NuevoUsuarioValues) {
    setError(null)
    crear.mutate(v, {
      onSuccess: () => setCreado({ correo: v.correo, contrasena: v.contrasena, rol: NOMBRE_ROL[v.rol] }),
      onError: (e) => setError(mensajeError(e)),
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <Label htmlFor="nu-nombre">Nombre completo</Label>
        <Input id="nu-nombre" autoComplete="off" aria-invalid={!!errors.nombre} {...register('nombre')} />
        <FieldError>{errors.nombre?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="nu-correo">Correo (será su usuario)</Label>
        <Input id="nu-correo" type="email" autoComplete="off" aria-invalid={!!errors.correo} {...register('correo')} />
        <FieldError>{errors.correo?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor="nu-rol">Rol</Label>
        <Select id="nu-rol" {...register('rol')}>
          {ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
        </Select>
      </div>
      {rol === 'vendedor' && <SelectorLocal id="nu-local" registro={register('local_id')} error={errors.local_id?.message} />}
      <div>
        <Label htmlFor="nu-clave">Contraseña temporal</Label>
        <div className="flex gap-2">
          <Input id="nu-clave" type="text" autoComplete="off" spellCheck={false} className="font-mono" aria-invalid={!!errors.contrasena} {...register('contrasena')} />
          <Button type="button" variant="outline" onClick={() => setValue('contrasena', generarContrasena(), { shouldValidate: true })} aria-label="Generar otra contraseña">
            <KeyRound /> Generar
          </Button>
        </div>
        <FieldError>{errors.contrasena?.message}</FieldError>
      </div>
      <details className="rounded-lg border border-border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold">Más datos (opcional)</summary>
        <div className="mt-3 grid gap-3">
          <div><Label htmlFor="nu-negocio">Negocio</Label><Input id="nu-negocio" {...register('negocio')} /></div>
          <div><Label htmlFor="nu-tel">Celular</Label><Input id="nu-tel" type="tel" {...register('telefono')} /></div>
          <div><Label htmlFor="nu-doc">Cédula o RUC</Label><Input id="nu-doc" {...register('cedula_ruc')} /></div>
          <div><Label htmlFor="nu-ciudad">Ciudad</Label><Input id="nu-ciudad" {...register('ciudad')} /></div>
        </div>
      </details>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear cuenta con acceso'}</Button>
    </form>
  )
}

/** Restablecer la contraseña de una persona (la define el admin). */
export function RestablecerContrasena({ id, nombre }: { id: string; nombre: string }) {
  const cambiar = useCambiarContrasena()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<NuevaContrasenaUsuarioValues>({
    resolver: zodResolver(nuevaContrasenaUsuarioSchema),
    defaultValues: { contrasena: '' },
  })

  function onSubmit(v: NuevaContrasenaUsuarioValues) {
    setError(null)
    setHecho(null)
    cambiar.mutate(
      { id, contrasena: v.contrasena },
      { onSuccess: () => { setHecho(v.contrasena); reset({ contrasena: '' }) }, onError: (e) => setError(mensajeError(e)) },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3 border-t border-border pt-5">
      <h3 className="text-xl">Restablecer contraseña</h3>
      <p className="text-sm text-muted-foreground">Define una contraseña nueva para {nombre || 'esta persona'} y entrégasela. Cierra su sesión anterior solo cuando vuelva a ingresar.</p>
      <div className="flex gap-2">
        <Input aria-label="Contraseña nueva" type="text" autoComplete="off" spellCheck={false} className="font-mono" aria-invalid={!!errors.contrasena} {...register('contrasena')} />
        <Button type="button" variant="outline" onClick={() => setValue('contrasena', generarContrasena(), { shouldValidate: true })}><KeyRound /> Generar</Button>
      </div>
      <FieldError>{errors.contrasena?.message ?? error ?? undefined}</FieldError>
      {hecho && (
        <p role="status" className="flex flex-wrap items-center gap-3 rounded-md bg-success/10 p-3 text-sm">
          Contraseña cambiada: <span className="font-mono">{hecho}</span> <Copiar texto={hecho} etiqueta="Copiar" />
        </p>
      )}
      <Button type="submit" variant="outline" disabled={cambiar.isPending}>{cambiar.isPending ? 'Guardando…' : 'Guardar contraseña'}</Button>
    </form>
  )
}

/** Eliminar a una persona: pide confirmación y el servidor rechaza si tiene entregas o ventas abiertas. */
export function EliminarUsuario({ id, nombre, onListo }: { id: string; nombre: string; onListo: () => void }) {
  const eliminar = useEliminarUsuario()
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onEliminar() {
    setError(null)
    eliminar.mutate(id, { onSuccess: onListo, onError: (e) => setError(mensajeError(e)) })
  }

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <h3 className="text-xl">Eliminar usuario</h3>
      <p className="text-sm text-muted-foreground">
        {nombre || 'Esta persona'} pierde el acceso para siempre. Sus pedidos y ventas se conservan en el historial. Si solo quieres que no entre por un tiempo, cambia su estado a Suspendido.
      </p>
      <FieldError>{error ?? undefined}</FieldError>
      {confirmar ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="text-destructive" disabled={eliminar.isPending} onClick={onEliminar}>
            {eliminar.isPending ? 'Eliminando…' : 'Sí, eliminar'}
          </Button>
          <Button type="button" variant="ghost" disabled={eliminar.isPending} onClick={() => setConfirmar(false)}>No</Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirmar(true)}>Eliminar usuario</Button>
      )}
    </div>
  )
}
