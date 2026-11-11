import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { buildBrandTokens, contrastRatio } from '@/lib/color'
import { mensajeError } from '@/lib/errors'
import { comprimirImagen } from '@/lib/imagen'
import { useActualizarMiTienda, useImagenTienda, useMiTienda } from '../hooks/useMayorista'
import { seccionSchema, type SeccionValues } from '../schemas'
import type { MiTienda } from '../api/mayorista'

function SubirImagen({ tienda, tipo, max }: { tienda: MiTienda; tipo: 'logo' | 'banner'; max: number }) {
  const subir = useImagenTienda(tienda.id)
  const ref = useRef<HTMLInputElement>(null)
  const url = tipo === 'logo' ? tienda.logo_url : tienda.banner_url

  async function onFile(f: File | undefined) {
    if (!f) return
    try {
      await subir.mutateAsync({ tipo, blob: await comprimirImagen(f, max) })
      toast.success(tipo === 'logo' ? 'Logo actualizado' : 'Banner actualizado')
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <p className="eyebrow mb-2">{tipo === 'logo' ? 'Logo' : 'Banner del inicio'}</p>
      <div className="flex items-center gap-3">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-input bg-muted ${tipo === 'logo' ? 'size-20' : 'h-20 w-36'}`}>
          {url ? <img src={url} alt="" className="size-full object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="outline" disabled={subir.isPending} onClick={() => ref.current?.click()}>{url ? 'Cambiar' : 'Subir'}</Button>
          {url && <Button type="button" size="sm" variant="ghost" disabled={subir.isPending} onClick={() => subir.mutate({ tipo, blob: null })}><Trash2 /> Quitar</Button>}
        </div>
      </div>
    </div>
  )
}

export function MiSeccionPage() {
  const { data: tienda, isLoading } = useMiTienda()
  const guardar = useActualizarMiTienda(tienda?.id ?? '')
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<SeccionValues>({ resolver: zodResolver(seccionSchema) })

  useEffect(() => {
    if (tienda) reset({ nombre: tienda.nombre, slug: tienda.slug, color_primario: tienda.color_primario, color_acento: tienda.color_acento, whatsapp: tienda.whatsapp ?? '', plantilla_mensaje: tienda.plantilla_mensaje })
  }, [tienda, reset])

  const vista = useWatch({ control })
  const tokens = buildBrandTokens({ primary: vista.color_primario ?? '#0b0b0c', accent: vista.color_acento ?? '#c8ff2e' })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (!tienda) return <p>Tu tienda se crea al aprobar tu cuenta.</p>

  return (
    <>
      <PageHeader title="Mi sección" description="Personaliza cómo ven tus clientes tu catálogo. Los productos y las fotos los administra Elite Sport." />
      <div className="grid gap-10 xl:grid-cols-[1fr_24rem]">
        <form
          noValidate
          className="max-w-2xl space-y-7"
          onSubmit={handleSubmit((v) =>
            guardar.mutate({ ...v, whatsapp: v.whatsapp || null }, {
              onSuccess: () => toast.success('Cambios guardados'),
              onError: (e) => {
                const m = mensajeError(e)
                if (/duplicate|unique/i.test(m)) setError('slug', { message: 'Ese enlace ya está en uso. Elige otro.' })
                else toast.error(m)
              },
            }),
          )}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <SubirImagen tienda={tienda} tipo="logo" max={600} />
            <SubirImagen tienda={tienda} tipo="banner" max={1920} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="s-nombre">Nombre de tu tienda</Label>
              <Input id="s-nombre" aria-invalid={!!errors.nombre} {...register('nombre')} />
              <FieldError>{errors.nombre?.message}</FieldError>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="s-slug">Enlace</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{window.location.host}/t/</span>
                <Input id="s-slug" aria-invalid={!!errors.slug} {...register('slug')} />
              </div>
              <FieldError>{errors.slug?.message}</FieldError>
              <p className="mt-1 text-xs text-muted-foreground">Si lo cambias, el enlace anterior deja de funcionar.</p>
            </div>
            <div>
              <Label htmlFor="s-p">Color principal</Label>
              <Input id="s-p" type="color" className="h-12 cursor-pointer p-1" {...register('color_primario')} />
            </div>
            <div>
              <Label htmlFor="s-a">Color de acento</Label>
              <Input id="s-a" type="color" className="h-12 cursor-pointer p-1" {...register('color_acento')} />
            </div>
            {tokens.adjusted && <p className="sm:col-span-2 text-sm text-warning">El acento se leía poco sobre el color principal, así que lo ajustamos automáticamente para que cumpla el contraste.</p>}
            <div className="sm:col-span-2">
              <Label htmlFor="s-wa">WhatsApp para pedidos</Label>
              <Input id="s-wa" inputMode="tel" placeholder="593991234567" aria-invalid={!!errors.whatsapp} {...register('whatsapp')} />
              <FieldError>{errors.whatsapp?.message}</FieldError>
              <p className="mt-1 text-xs text-muted-foreground">Es el número de tu tienda: allí se abre el WhatsApp de tus clientes. Los pedidos llegan siempre a la pestaña Clientes de este panel, tengas o no WhatsApp.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="s-msg">Saludo del mensaje</Label>
              <Textarea id="s-msg" className="min-h-20" aria-invalid={!!errors.plantilla_mensaje} {...register('plantilla_mensaje')} />
              <FieldError>{errors.plantilla_mensaje?.message}</FieldError>
              <p className="mt-1 text-xs text-muted-foreground">Va al inicio del WhatsApp, antes del detalle del pedido.</p>
            </div>
          </div>
          <Button type="submit" disabled={!isDirty || guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar cambios'}</Button>
        </form>

        <aside aria-label="Vista previa" className="self-start">
          <p className="eyebrow mb-2">Vista previa</p>
          <div className="overflow-hidden rounded-xl border border-border" style={{ ['--brand-primary' as string]: tokens.primary, ['--brand-primary-fg' as string]: tokens.primaryFg, ['--brand-accent' as string]: tokens.accent, ['--brand-accent-fg' as string]: tokens.accentFg }}>
            <div className="flex h-14 items-center bg-brand px-4 text-brand-foreground"><Logo nombre={vista.nombre || tienda.nombre} logoUrl={tienda.logo_url} /></div>
            <div className="relative bg-brand px-4 pb-8 pt-10 text-brand-foreground">
              {tienda.banner_url && <img src={tienda.banner_url} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
              <p className="relative font-display text-4xl font-extrabold uppercase leading-[0.9]">Hecho para moverte</p>
              <span className="relative mt-5 inline-flex h-10 items-center rounded-md bg-signal px-4 text-xs font-semibold uppercase tracking-[0.08em] text-signal-foreground">Ver catálogo</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">Contraste acento / principal: {contrastRatio(tokens.accent, tokens.primary).toFixed(1)}:1</p>
        </aside>
      </div>
    </>
  )
}
