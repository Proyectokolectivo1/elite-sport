import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Price } from '@/components/ui/price'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { useActualizarPrecios, useProductos } from '@/features/catalogo/hooks/useCatalogo'
import type { ProductoResumen } from '@/features/catalogo/api/catalogo'
import { useEspeciales, useGuardarEspecial, useMayoristas } from '@/features/mayoristas/hooks/useMayoristas'
import type { PrecioEspecial } from '@/features/mayoristas/api/mayoristas'
import { mensajeError } from '@/lib/errors'

const numero = (v: string): number | null => (v.trim() === '' ? null : Number(v))

function FilaBase({ p }: { p: ProductoResumen }) {
  const guardar = useActualizarPrecios()
  const [pvp, setPvp] = useState(String(p.precio_publico))
  const [may, setMay] = useState(p.precio_mayorista === null ? '' : String(p.precio_mayorista))

  const nPvp = Number(pvp)
  const nMay = numero(may)
  const cambio = nPvp !== p.precio_publico || nMay !== p.precio_mayorista
  const error =
    !Number.isFinite(nPvp) || nPvp < 0 ? 'Precio no válido'
    : nMay !== null && (!Number.isFinite(nMay) || nMay < 0) ? 'Precio mayorista no válido'
    : nMay !== null && nMay > nPvp ? 'El mayorista supera el PVP'
    : null

  return (
    <TR>
      <TD className="font-semibold">{p.nombre}<span className="block text-xs font-normal text-muted-foreground">{p.marca}</span></TD>
      <TD>
        <Input aria-label={`Precio al público de ${p.nombre}`} type="number" step="0.01" min="0" inputMode="decimal" className="h-9 w-28 text-right" value={pvp} onChange={(e) => setPvp(e.target.value)} />
      </TD>
      <TD>
        <Input aria-label={`Precio mayorista de ${p.nombre}`} type="number" step="0.01" min="0" inputMode="decimal" className="h-9 w-28 text-right" placeholder="Sin precio" value={may} onChange={(e) => setMay(e.target.value)} />
      </TD>
      <TD className="text-right">
        {error && <span role="alert" className="mr-3 text-xs text-destructive">{error}</span>}
        <Button
          size="sm"
          disabled={!cambio || !!error || guardar.isPending}
          onClick={() => guardar.mutate({ id: p.id, publico: nPvp, mayorista: nMay }, { onSuccess: () => toast.success('Precios guardados'), onError: (e) => toast.error(mensajeError(e)) })}
        >
          Guardar
        </Button>
      </TD>
    </TR>
  )
}

function FilaEspecial({ p, mayoristaId, actual }: { p: ProductoResumen; mayoristaId: string; actual: PrecioEspecial | undefined }) {
  const guardar = useGuardarEspecial(mayoristaId)
  const inicial = actual ? (actual.precio !== null ? 'precio' : 'descuento') : 'ninguno'
  const [tipo, setTipo] = useState<'ninguno' | 'precio' | 'descuento'>(inicial)
  const [valor, setValor] = useState(actual ? String(actual.precio ?? actual.descuentoPct ?? '') : '')

  const n = Number(valor)
  const base = p.precio_mayorista
  const efectivo =
    tipo === 'precio' && Number.isFinite(n) ? n
    : tipo === 'descuento' && base !== null && Number.isFinite(n) ? Math.round(base * (1 - n / 100) * 100) / 100
    : base
  const invalido = tipo !== 'ninguno' && (valor === '' || !Number.isFinite(n) || n < 0 || (tipo === 'descuento' && n > 100))
  const igual = tipo === inicial && (tipo === 'ninguno' || n === (actual?.precio ?? actual?.descuentoPct))

  return (
    <TR>
      <TD className="font-semibold">{p.nombre}</TD>
      <TD className="text-right">{base === null ? <span className="text-muted-foreground">Sin precio</span> : <Price amount={base} size="sm" />}</TD>
      <TD>
        <div className="flex gap-2">
          <Select aria-label={`Tipo de precio especial de ${p.nombre}`} className="h-9 w-36" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="ninguno">Precio base</option>
            <option value="precio">Precio fijo</option>
            <option value="descuento">Descuento %</option>
          </Select>
          {tipo !== 'ninguno' && (
            <Input aria-label="Valor" type="number" step="0.01" min="0" inputMode="decimal" className="h-9 w-24 text-right" value={valor} onChange={(e) => setValor(e.target.value)} />
          )}
        </div>
      </TD>
      <TD className="text-right">{efectivo === null ? 'Sin precio' : <Price amount={efectivo} size="sm" />}</TD>
      <TD className="text-right">
        <Button
          size="sm"
          disabled={igual || invalido || guardar.isPending || (tipo === 'descuento' && base === null)}
          onClick={() =>
            guardar.mutate(
              { productoId: p.id, valor: tipo === 'ninguno' ? null : { tipo, valor: n } },
              { onSuccess: () => toast.success('Precio especial guardado'), onError: (e) => toast.error(mensajeError(e)) },
            )
          }
        >
          Guardar
        </Button>
      </TD>
    </TR>
  )
}

function PorMayorista() {
  const { data: mayoristas = [] } = useMayoristas()
  const { data: productos = [] } = useProductos()
  const aprobados = mayoristas.filter((m) => m.estado === 'aprobado')
  const [id, setId] = useState('')
  const { data: especiales = [], isLoading } = useEspeciales(id)

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Select aria-label="Mayorista" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Elige un mayorista</option>
          {aprobados.map((m) => <option key={m.id} value={m.id}>{m.negocio || m.nombre}</option>)}
        </Select>
      </div>
      {aprobados.length === 0 && <EmptyState title="Sin mayoristas aprobados" description="Aprueba un mayorista para asignarle precios especiales." />}
      {id && (isLoading ? <Skeleton className="h-48 w-full" /> : (
        <Table>
          <THead><TR><TH>Producto</TH><TH className="text-right">Mayorista base</TH><TH>Precio especial</TH><TH className="text-right">Le cobras</TH><TH><span className="sr-only">Guardar</span></TH></TR></THead>
          <TBody>
            {productos.map((p) => <FilaEspecial key={`${id}-${p.id}-${especiales.length}`} p={p} mayoristaId={id} actual={especiales.find((e) => e.productoId === p.id)} />)}
          </TBody>
        </Table>
      ))}
    </div>
  )
}

export function PreciosPage() {
  const { data = [], isLoading } = useProductos()
  const [tab, setTab] = useState<'base' | 'mayorista'>('base')
  return (
    <>
      <PageHeader title="Precios" description="El precio mayorista nunca se muestra al público: solo lo ven los mayoristas aprobados." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ id: 'base', label: 'Precios base' }, { id: 'mayorista', label: 'Por mayorista' }]} />
      {tab === 'base' && (isLoading ? <Skeleton className="h-64 w-full" /> : data.length === 0 ? <EmptyState title="Sin productos" description="Crea productos para fijar sus precios." /> : (
        <Table>
          <THead><TR><TH>Producto</TH><TH>Precio al público</TH><TH>Precio mayorista</TH><TH><span className="sr-only">Guardar</span></TH></TR></THead>
          <TBody>{data.map((p) => <FilaBase key={`${p.id}-${p.precio_publico}-${p.precio_mayorista}`} p={p} />)}</TBody>
        </Table>
      ))}
      {tab === 'mayorista' && <PorMayorista />}
    </>
  )
}
