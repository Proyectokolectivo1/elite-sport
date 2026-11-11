import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { comprimirImagen } from '@/lib/imagen'
import { mensajeError } from '@/lib/errors'
import { actualizarFondo, borrarMedioFondo, subirMedioFondo, type Configuracion, type MedioFondo } from '../api/configuracion'
import { configuracionKey } from '../hooks/useConfiguracion'

const CAMPO: Record<MedioFondo, 'fondo_video_url' | 'fondo_video_movil_url' | 'fondo_poster_url'> = {
  video: 'fondo_video_url',
  'video-movil': 'fondo_video_movil_url',
  poster: 'fondo_poster_url',
}

const INFO: Record<MedioFondo, { titulo: string; ayuda: string; accept: string }> = {
  video: { titulo: 'Video para computador', ayuda: 'Horizontal 16:9, 1080p, de 6 a 10 segundos, sin audio. Ideal por debajo de 12 MB.', accept: 'video/mp4,video/webm' },
  'video-movil': { titulo: 'Video para celular', ayuda: 'Vertical 9:16, 540 × 960, mismo recorrido. Ideal por debajo de 6 MB. Si no subes uno, el celular usa el de computador.', accept: 'video/mp4,video/webm' },
  poster: { titulo: 'Imagen de respaldo', ayuda: 'Se ve mientras carga el video y si la persona tiene activado "reducir movimiento" o ahorro de datos.', accept: 'image/jpeg,image/png,image/webp' },
}

function Medio({ tipo, config }: { tipo: MedioFondo; config: Configuracion }) {
  const url = config[CAMPO[tipo]]
  const qc = useQueryClient()
  const ref = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  const cambiar = useMutation({
    mutationFn: async (archivo: File | null) => {
      let nueva: string | null = null
      if (archivo) {
        const pieza = tipo === 'poster' && archivo.type.startsWith('image/') ? await comprimirImagen(archivo, 1920, 0.8) : archivo
        nueva = await subirMedioFondo(tipo, pieza)
      }
      await actualizarFondo({ [CAMPO[tipo]]: nueva })
      await borrarMedioFondo(url)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: configuracionKey }),
  })

  async function onFile(f: File | undefined) {
    if (!f) return
    setSubiendo(true)
    try {
      await cambiar.mutateAsync(f)
      toast.success('Archivo actualizado')
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setSubiendo(false)
      if (ref.current) ref.current.value = ''
    }
  }

  const info = INFO[tipo]
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-semibold">{info.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">{info.ayuda}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid h-20 w-14 shrink-0 place-items-center overflow-hidden rounded-sm bg-muted text-[0.625rem] text-muted-foreground">
          {url ? (tipo === 'poster' ? <img src={url} alt="" className="size-full object-cover" /> : <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />) : 'Vacío'}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={ref} type="file" accept={info.accept} hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="outline" disabled={subiendo} onClick={() => ref.current?.click()}><Upload /> {subiendo ? 'Subiendo…' : url ? 'Reemplazar' : 'Subir'}</Button>
          {url && <Button type="button" size="sm" variant="ghost" disabled={subiendo} onClick={() => cambiar.mutate(null, { onError: (e) => toast.error(mensajeError(e)) })}><Trash2 /> Quitar</Button>}
        </div>
      </div>
    </div>
  )
}

/** Personalización del video de fondo que avanza con el scroll. */
export function FondoAdmin({ config }: { config: Configuracion }) {
  const qc = useQueryClient()
  const [opacidad, setOpacidad] = useState(config.fondo_opacidad)
  const guardar = useMutation({
    mutationFn: actualizarFondo,
    onSuccess: () => qc.invalidateQueries({ queryKey: configuracionKey }),
    onError: (e) => toast.error(mensajeError(e)),
  })
  const sinMedios = !config.fondo_video_url && !config.fondo_poster_url

  return (
    <fieldset className="space-y-5">
      <legend className="mb-4 font-display text-3xl font-bold uppercase">Fondo en movimiento</legend>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Un video detrás de toda la tienda que avanza mientras la persona baja con el scroll (por ejemplo, alguien corriendo). Se ve en la tienda principal y en las secciones de los mayoristas. Cómo preparar el video: <code className="rounded bg-muted px-1">docs/FONDO_VIDEO.md</code>.
      </p>

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-5 accent-[var(--foreground)]" checked={config.fondo_activo} disabled={guardar.isPending || sinMedios} onChange={(e) => guardar.mutate({ fondo_activo: e.target.checked }, { onSuccess: () => toast.success(e.target.checked ? 'Fondo activado' : 'Fondo desactivado') })} />
        Mostrar el fondo en la tienda
        {sinMedios && <span className="text-xs font-normal text-muted-foreground">(sube un video o una imagen primero)</span>}
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <Medio tipo="video" config={config} />
        <Medio tipo="video-movil" config={config} />
        <Medio tipo="poster" config={config} />
      </div>

      <div className="max-w-md">
        <label htmlFor="fondo-op" className="eyebrow mb-1.5 block">Velo sobre el video: {Math.round(opacidad * 100)}%</label>
        <input
          id="fondo-op"
          type="range"
          min="0.3"
          max="0.95"
          step="0.05"
          value={opacidad}
          className="w-full accent-[var(--foreground)]"
          onChange={(e) => setOpacidad(Number(e.target.value))}
          onPointerUp={() => guardar.mutate({ fondo_opacidad: opacidad })}
          onKeyUp={() => guardar.mutate({ fondo_opacidad: opacidad })}
        />
        <p className="mt-1 text-xs text-muted-foreground">Más velo = texto más legible y video más tenue. Menos velo = más protagonismo de la persona corriendo.</p>
      </div>
    </fieldset>
  )
}
