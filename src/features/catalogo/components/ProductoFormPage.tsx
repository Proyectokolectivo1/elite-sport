import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
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

function SelectOpcion({ tabla, etiqueta, ...rest }: { tabla: TablaOpciones; etiqueta: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { data = [] } = useOpciones(tabla)
  return (
    <div>
      <div className="flex items-end justify-between">
        <Label htmlFor={rest.id}>{etiqueta}</Label>
        <NuevaOpcion tabla={tabla} etiqueta={etiqueta} />
      </div>
      <Select {...rest}>
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
  const [tab, setTab] = useState<'datos' | 'imagenes' | 'variantes'>('datos')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProductoValues>({ resolver: zodResolver(productoSchema), defaultValues: VACIO })

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
      toast.success('Producto guardado')
      if (!id) navigate(`/admin/productos/${nuevoId}`, { replace: true })
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

      {id && (
        <Tabs
          className="mb-6"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'datos', label: 'Datos y precios' },
            { id: 'imagenes', label: 'Imágenes' },
            { id: 'variantes', label: 'Tallas y stock' },
          ]}
        />
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
              <Select id="grupo" disabled={!!producto} {...register('grupo')}>
                {GRUPOS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
              {producto && <p className="mt-1 text-xs text-muted-foreground">No se puede cambiar: define las tallas del inventario.</p>}
            </div>
            <SelectOpcion id="marca" tabla="marcas" etiqueta="Marca" {...register('marca_id')} />
            <SelectOpcion id="categoria" tabla="categorias" etiqueta="Categoría" {...register('categoria_id')} />
            <SelectOpcion id="estilo" tabla="estilos" etiqueta="Estilo" {...register('estilo_id')} />
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
              {guardar.isPending ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear producto'}
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
