import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { useEliminarProducto, useGuardarProducto, useOpciones, useProducto } from '../hooks/useCatalogo'
import { GRUPOS, productoSchema, type ProductoValues } from '../schemas'
import type { TablaOpciones } from '../api/catalogo'
import { ImagenesProducto } from './ImagenesProducto'
import { VariantesProducto } from './VariantesProducto'
import { NuevaOpcion } from './NuevaOpcion'

type Tab = 'datos' | 'imagenes' | 'variantes'

const VACIO: ProductoValues = {
  nombre: '',
  grupo: 'caballero',
  marca_id: '',
  categoria_id: '',
  estilo_id: '',
  descripcion: '',
  precio_publico: 0,
  precio_mayorista: null,
  activo: true,
  destacado: false,
}

function SelectOpcion({ tabla, etiqueta, id, value, onValor }: { tabla: TablaOpciones; etiqueta: string; id: string; value: string; onValor: (v: string) => void }) {
  const { data = [] } = useOpciones(tabla)
  return (
    <div>
      <div className="flex items-end justify-between">
        <Label htmlFor={id}>{etiqueta}</Label>
        <NuevaOpcion tabla={tabla} etiqueta={etiqueta} />
      </div>
      <Select id={id} value={value} onChange={(e) => onValor(e.target.value)}>
        <option value="">Sin asignar</option>
        {data.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </Select>
    </div>
  )
}

export function ProductoFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: producto, isLoading } = useProducto(id)
  const guardar = useGuardarProducto(id)
  const eliminar = useEliminarProducto()
  const location = useLocation()
  // Al crear un producto se vuelve a montar la página con su id: llega aquí directo a la pestaña de fotos.
  const tabInicial = (location.state as { tab?: Tab } | null)?.tab
  const [tab, setTab] = useState<Tab>(id && tabInicial ? tabInicial : 'datos')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<ProductoValues>({ resolver: zodResolver(productoSchema), defaultValues: VACIO })

  const sel = useWatch({ control })

  useEffect(() => {
    if (!producto) return
    reset({
      nombre: producto.nombre,
      grupo: producto.grupo,
      marca_id: producto.marca_id ?? '',
      categoria_id: producto.categoria_id ?? '',
      estilo_id: producto.estilo_id ?? '',
      descripcion: producto.descripcion ?? '',
      precio_publico: producto.precio_publico,
      precio_mayorista: producto.precio_mayorista,
      activo: producto.activo,
      destacado: producto.destacado,
    })
  }, [producto, reset])

  async function onSubmit(v: ProductoValues) {
    try {
      const nuevoId = await guardar.mutateAsync({
        ...v,
        marca_id: v.marca_id || null,
        categoria_id: v.categoria_id || null,
        estilo_id: v.estilo_id || null,
        descripcion: v.descripcion.trim() || null,
      })
      if (id) {
        toast.success('Producto guardado')
      } else {
        toast.success('Producto creado. Ahora sube sus fotos.')
        // /nuevo y /:id usan la misma instancia de la página (no se vuelve a montar): se cambia la pestaña aquí.
        setTab('imagenes')
        navigate(`/admin/productos/${nuevoId}`, { replace: true, state: { tab: 'imagenes' } })
      }
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  async function borrar() {
    if (!id) return
    try {
      await eliminar.mutateAsync(id)
      toast.success('Producto eliminado')
      navigate('/admin/productos', { replace: true })
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  if (id && isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <>
      <Link to="/admin/productos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Productos
      </Link>
      <PageHeader title={id ? (producto?.nombre ?? 'Producto') : 'Nuevo producto'} />

      <Tabs
        className="mb-6"
        value={tab}
        onChange={(t) => {
          if (id || t === 'datos') setTab(t)
          else toast.show('Primero crea el producto con sus datos. Luego subes las fotos aquí mismo.')
        }}
        tabs={[
          { id: 'datos', label: 'Datos y precios' },
          { id: 'imagenes', label: 'Imágenes' },
          { id: 'variantes', label: 'Tallas y stock' },
        ]}
      />
      {!id && (
        <p className="mb-6 max-w-3xl rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Completa los datos y pulsa <strong className="text-foreground">Crear y subir fotos</strong>: el producto se guarda y pasas directo a la sección de imágenes, sin salir de aquí.
        </p>
      )}

      {tab === 'datos' && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-3xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" aria-invalid={!!errors.nombre} {...register('nombre')} />
              <FieldError>{errors.nombre?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="grupo">Grupo de tallas</Label>
              <Select id="grupo" disabled={!!producto} value={sel.grupo} {...register('grupo')}>
                {GRUPOS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
              {producto && <p className="mt-1 text-xs text-muted-foreground">No se puede cambiar: define las tallas del inventario.</p>}
            </div>
            <SelectOpcion id="marca" value={sel.marca_id ?? ''} tabla="marcas" etiqueta="Marca" onValor={(v) => setValue('marca_id', v, { shouldDirty: true })} />
            <SelectOpcion id="categoria" value={sel.categoria_id ?? ''} tabla="categorias" etiqueta="Categoría" onValor={(v) => setValue('categoria_id', v, { shouldDirty: true })} />
            <SelectOpcion id="estilo" value={sel.estilo_id ?? ''} tabla="estilos" etiqueta="Estilo" onValor={(v) => setValue('estilo_id', v, { shouldDirty: true })} />
            <div className="sm:col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea id="descripcion" {...register('descripcion')} />
              <FieldError>{errors.descripcion?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="pvp">Precio al público</Label>
              <Input id="pvp" type="number" step="0.01" min="0" inputMode="decimal" aria-invalid={!!errors.precio_publico} {...register('precio_publico', { valueAsNumber: true })} />
              <FieldError>{errors.precio_publico?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="may">Precio mayorista</Label>
              <Input
                id="may"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Sin precio mayorista"
                aria-invalid={!!errors.precio_mayorista}
                {...register('precio_mayorista', { setValueAs: (x) => (x === '' || x === null || x === undefined ? null : Number(x)) })}
              />
              <FieldError>{errors.precio_mayorista?.message}</FieldError>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--foreground)]" {...register('activo')} /> Visible en la tienda
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--foreground)]" {...register('destacado')} /> Destacado en el inicio
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button type="submit" disabled={guardar.isPending || (!!id && !isDirty)}>
              {guardar.isPending ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear y subir fotos'}
            </Button>
            {id && (
              <Dialog>
                <DialogTrigger render={<Button type="button" variant="ghost" className="text-destructive" />}>Eliminar</DialogTrigger>
                <DialogContent title="Eliminar producto" description="Se borran también sus imágenes, variantes y el stock registrado. Los pedidos que lo incluyen impiden la eliminación.">
                  <div className="flex justify-end gap-2">
                    <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
                    <Button variant="destructive" onClick={() => void borrar()}>Eliminar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </form>
      )}

      {id && tab === 'imagenes' && <ImagenesProducto productoId={id} />}
      {id && tab === 'variantes' && <VariantesProducto productoId={id} />}
    </>
  )
}
