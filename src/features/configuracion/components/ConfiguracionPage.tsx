import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { actualizarConfiguracion } from '../api/configuracion'
import { configuracionKey, useConfiguracion } from '../hooks/useConfiguracion'
import { FondoAdmin } from './FondoAdmin'
import { configuracionSchema, type ConfiguracionValues } from '../schemas'

export function ConfiguracionPage() {
  const { data, isLoading } = useConfiguracion()
  const qc = useQueryClient()
  const guardar = useMutation({
    mutationFn: (v: ConfiguracionValues) => actualizarConfiguracion({ ...v, whatsapp_principal: v.whatsapp_principal || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: configuracionKey }),
  })
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<ConfiguracionValues>({ resolver: zodResolver(configuracionSchema) })

  useEffect(() => {
    if (data) reset({ nombre_negocio: data.nombre_negocio, ciudad: data.ciudad, moneda_codigo: data.moneda_codigo, moneda_simbolo: data.moneda_simbolo, moneda_decimales: data.moneda_decimales, locale: data.locale, whatsapp_principal: data.whatsapp_principal ?? '' })
  }, [data, reset])

  const vista = useWatch({ control })
  let ejemplo: string
  try {
    ejemplo = formatMoney(1234.5, {
      moneda_codigo: vista.moneda_codigo?.toUpperCase() || 'USD',
      moneda_simbolo: vista.moneda_simbolo || '$',
      moneda_decimales: Number(vista.moneda_decimales ?? 2),
      locale: vista.locale || 'es-EC',
    })
  } catch {
    ejemplo = 'Formato no válido'
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  return (
    <>
      <PageHeader title="Configuración" description="La moneda se aplica a todos los precios del sitio, incluidas las secciones de los mayoristas." />
      <form
        noValidate
        className="max-w-3xl space-y-8"
        onSubmit={handleSubmit((v) => guardar.mutate(v, { onSuccess: () => toast.success('Configuración guardada'), onError: (e) => toast.error(mensajeError(e)) }))}
      >
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-3xl font-display font-bold uppercase">Negocio</legend>
          <div>
            <Label htmlFor="c-nombre">Nombre</Label>
            <Input id="c-nombre" aria-invalid={!!errors.nombre_negocio} {...register('nombre_negocio')} />
            <FieldError>{errors.nombre_negocio?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-ciudad">Ciudad</Label>
            <Input id="c-ciudad" aria-invalid={!!errors.ciudad} {...register('ciudad')} />
            <FieldError>{errors.ciudad?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-wa">WhatsApp principal</Label>
            <Input id="c-wa" inputMode="tel" placeholder="593991234567" aria-invalid={!!errors.whatsapp_principal} {...register('whatsapp_principal')} />
            <FieldError>{errors.whatsapp_principal?.message}</FieldError>
            <p className="mt-1 text-xs text-muted-foreground">Recibe los pedidos de la tienda principal. Con código de país, sin espacios ni signos.</p>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-3xl font-display font-bold uppercase">Moneda</legend>
          <div>
            <Label htmlFor="c-cod">Código ISO</Label>
            <Input id="c-cod" maxLength={3} className="uppercase" aria-invalid={!!errors.moneda_codigo} {...register('moneda_codigo')} />
            <FieldError>{errors.moneda_codigo?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-sim">Símbolo</Label>
            <Input id="c-sim" aria-invalid={!!errors.moneda_simbolo} {...register('moneda_simbolo')} />
            <FieldError>{errors.moneda_simbolo?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-dec">Decimales</Label>
            <Input id="c-dec" type="number" min="0" max="4" step="1" aria-invalid={!!errors.moneda_decimales} {...register('moneda_decimales', { valueAsNumber: true })} />
            <FieldError>{errors.moneda_decimales?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="c-loc">Formato regional</Label>
            <Input id="c-loc" placeholder="es-EC" aria-invalid={!!errors.locale} {...register('locale')} />
            <FieldError>{errors.locale?.message}</FieldError>
          </div>
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Vista previa: <strong className="font-display text-2xl text-foreground tabular-nums">{ejemplo}</strong>
          </p>
        </fieldset>

        <Button type="submit" disabled={!isDirty || guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
      </form>

      {data && (
        <div className="mt-12 max-w-4xl border-t border-border pt-8">
          <FondoAdmin config={data} />
        </div>
      )}
    </>
  )
}
