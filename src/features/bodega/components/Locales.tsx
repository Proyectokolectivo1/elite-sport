import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import type { Local } from '../api/bodega'
import { useGuardarLocal, useLocales } from '../hooks/useBodega'
import { localSchema, type LocalValues } from '../schemas'

/** Lista desplegable de locales activos, para asignar el local de un vendedor. */
export function SelectorLocal({ id, registro, error }: { id: string; registro: UseFormRegisterReturn; error?: string }) {
  const { data = [], isLoading } = useLocales()
  const activos = data.filter((l) => l.activo)
  return (
    <div>
      <Label htmlFor={id}>Local</Label>
      <Select id={id} disabled={isLoading} aria-invalid={!!error} {...registro}>
        <option value="">Elige el local</option>
        {activos.map((l) => (
          <option key={l.id} value={l.id}>{l.nombre}</option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-muted-foreground">Sus pedidos a bodega y sus ventas quedan a nombre de este local.</p>
      <FieldError>{error}</FieldError>
    </div>
  )
}

function FilaLocal({ local }: { local: Local }) {
  const guardar = useGuardarLocal()
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<LocalValues>({
    resolver: zodResolver(localSchema),
    defaultValues: { nombre: local.nombre },
  })

  function onSubmit(v: LocalValues) {
    guardar.mutate(
      { id: local.id, nombre: v.nombre },
      { onSuccess: () => { toast.success('Local actualizado'); reset(v) }, onError: (e) => toast.error(mensajeError(e)) },
    )
  }

  return (
    <li className="py-3">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-wrap items-center gap-2">
        <Input aria-label={`Nombre del local ${local.nombre}`} className="min-w-0 flex-1" aria-invalid={!!errors.nombre} {...register('nombre')} />
        {!local.activo && <Badge variant="neutral">Desactivado</Badge>}
        {isDirty && <Button type="submit" size="sm" disabled={guardar.isPending}>Guardar</Button>}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={guardar.isPending}
          onClick={() =>
            guardar.mutate(
              { id: local.id, activo: !local.activo },
              { onSuccess: () => toast.success(local.activo ? 'Local desactivado' : 'Local activado'), onError: (e) => toast.error(mensajeError(e)) },
            )
          }
        >
          {local.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </form>
      <FieldError>{errors.nombre?.message}</FieldError>
    </li>
  )
}

/** Locales del punto físico: el admin los crea, renombra o desactiva. No se borran para no perder el historial. */
export function Locales() {
  const { data = [], isLoading, error } = useLocales()
  const guardar = useGuardarLocal()
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LocalValues>({
    resolver: zodResolver(localSchema),
    defaultValues: { nombre: '' },
  })

  function onSubmit(v: LocalValues) {
    setErrorAlta(null)
    guardar.mutate(
      { nombre: v.nombre },
      { onSuccess: () => { toast.success(`Local ${v.nombre} creado`); reset({ nombre: '' }) }, onError: (e) => setErrorAlta(mensajeError(e)) },
    )
  }

  return (
    <div className="space-y-6">
      {isLoading && <Skeleton className="h-32 w-full" />}
      {error && <p role="alert" className="text-destructive">{mensajeError(error)}</p>}
      {data.length > 0 && (
        <ul className="divide-y divide-border">
          {data.map((l) => (
            <FilaLocal key={l.id} local={l} />
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-2 border-t border-border pt-5">
        <Label htmlFor="local-nuevo">Nuevo local</Label>
        <div className="flex gap-2">
          <Input id="local-nuevo" placeholder="Nombre del local" aria-invalid={!!errors.nombre} {...register('nombre')} />
          <Button type="submit" disabled={guardar.isPending}>Crear</Button>
        </div>
        <FieldError>{errors.nombre?.message ?? errorAlta ?? undefined}</FieldError>
      </form>
    </div>
  )
}
