import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { comprimirImagen } from '@/lib/imagen'
import { useEliminarImagen, useImagenes, useIntercambiarOrden, useSubirImagenes, useVariantes } from '../hooks/useCatalogo'

export function ImagenesProducto({ productoId }: { productoId: string }) {
  const { data: imagenes = [], isLoading } = useImagenes(productoId)
  const { data: variantes = [] } = useVariantes(productoId)
  const subir = useSubirImagenes(productoId)
  const eliminar = useEliminarImagen(productoId)
  const mover = useIntercambiarOrden(productoId)
  const [color, setColor] = useState('')
  const [procesando, setProcesando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const colores = useMemo(() => [...new Set([...variantes.map((v) => v.color), ...imagenes.map((i) => i.color)])], [variantes, imagenes])
  const porColor = useMemo(() => {
    const m = new Map<string, typeof imagenes>()
    for (const i of imagenes) m.set(i.color, [...(m.get(i.color) ?? []), i])
    return [...m.entries()]
  }, [imagenes])

  async function onArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!color.trim()) {
      toast.error('Indica primero el color de las fotos.')
      return
    }
    setProcesando(true)
    try {
      const blobs = await Promise.all([...files].map((f) => comprimirImagen(f)))
      const ordenInicial = imagenes.reduce((m, i) => Math.max(m, i.orden), -1) + 1
      await subir.mutateAsync({ color, blobs, ordenInicial })
      toast.success(blobs.length === 1 ? 'Imagen subida' : `${blobs.length} imágenes subidas`)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setProcesando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid max-w-3xl items-end gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="color-img">Color de las fotos</Label>
          <Input id="color-img" list="colores-producto" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej. Negro, Blanco hueso" />
          <datalist id="colores-producto">
            {colores.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => void onArchivos(e.target.files)} />
          <Button type="button" disabled={procesando || subir.isPending} onClick={() => inputRef.current?.click()}>
            <Upload /> {procesando || subir.isPending ? 'Subiendo…' : 'Subir fotos'}
          </Button>
        </div>
      </div>
      <p className="-mt-5 text-xs text-muted-foreground">Se reducen y convierten a WebP automáticamente. La primera foto de cada color es la principal.</p>

      {isLoading && <Skeleton className="h-48 w-full" />}
      {!isLoading && porColor.length === 0 && <EmptyState title="Sin fotos todavía" description="Sube fotos por color. Los mayoristas las reutilizan en su sección." />}

      {porColor.map(([c, lista]) => (
        <section key={c}>
          <h3 className="mb-3 text-2xl">{c}</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {lista.map((img, idx) => (
              <li key={img.id} className="group relative overflow-hidden rounded-md border border-border bg-muted">
                <img src={img.url} alt={`${c}, foto ${idx + 1}`} className="aspect-[4/5] w-full object-cover" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/65 p-1 text-white">
                  <span className="flex">
                    <Button type="button" size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="Mover antes" disabled={idx === 0 || mover.isPending} onClick={() => mover.mutate({ a: img, b: lista[idx - 1] })}>
                      <ArrowLeft />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="Mover después" disabled={idx === lista.length - 1 || mover.isPending} onClick={() => mover.mutate({ a: img, b: lista[idx + 1] })}>
                      <ArrowRight />
                    </Button>
                  </span>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-white hover:bg-white/15" aria-label="Eliminar foto" disabled={eliminar.isPending} onClick={() => eliminar.mutate(img, { onError: (e) => toast.error(mensajeError(e)) })}>
                    <Trash2 />
                  </Button>
                </div>
                {idx === 0 && <span className="absolute left-1.5 top-1.5 rounded-sm bg-signal px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-signal-foreground">Principal</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
