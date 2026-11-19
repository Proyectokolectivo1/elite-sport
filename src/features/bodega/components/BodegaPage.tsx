import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { NOMBRE_ROL } from '@/features/auth/roles'
import { mensajeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { PedidoBodega, VistaBodega } from '../api/bodega'
import { useCancelarPedidoBodega, useDespachar, useEntregarWeb, useFotoDeVariante, usePedidosBodega } from '../hooks/useBodega'
import { CierreEntrega } from './CierreEntrega'
import { FotoPar } from './FotoPar'
import { partesLinea } from './partesLinea'
import { idCierre, PendientesCierre } from './PendientesCierre'

const VISTAS: { id: VistaBodega; label: string; ruta: string }[] = [
  { id: 'por_despachar', label: 'Por despachar', ruta: '/admin/bodega' },
  { id: 'en_poder', label: 'Cierre del día', ruta: '/admin/bodega/cierre' },
  { id: 'web', label: 'Pedidos web', ruta: '/admin/bodega/web' },
  { id: 'historial', label: 'Historial', ruta: '/admin/bodega/historial' },
]

const TEXTOS: Record<VistaBodega, { titulo: string; descripcion: string; vacio: string }> = {
  por_despachar: {
    titulo: 'Despachos',
    descripcion: 'Pedidos del local y de los mayoristas del sector. Al despachar, los pares salen del stock y quedan en su poder.',
    vacio: 'No hay pedidos por despachar.',
  },
  en_poder: {
    titulo: 'Cierre del día',
    descripcion: 'Anota por línea cuántos pares se vendieron y cuántos regresan. Lo que regresa vuelve al inventario.',
    vacio: 'No hay mercancía en poder de nadie.',
  },
  web: {
    titulo: 'Pedidos web',
    descripcion: 'Pedidos confirmados por el administrador: prepáralos y márcalos como entregados.',
    vacio: 'No hay pedidos web por entregar.',
  },
  historial: { titulo: 'Historial', descripcion: 'Entregas cerradas o canceladas en los últimos 7 días.', vacio: 'Sin movimientos esta semana.' },
}

const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

function Encabezado({ p }: { p: PedidoBodega }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold uppercase leading-none">#{p.numero} · {p.tipo === 'consignacion' ? p.solicitante_nombre : p.cliente_nombre}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fecha.format(new Date(p.despachado_en ?? p.creado_en))}
          {p.tipo !== 'consignacion' && ` · ${p.cliente_telefono}`}
        </p>
      </div>
      {p.solicitante_rol && <Badge variant="outline">{NOMBRE_ROL[p.solicitante_rol]}</Badge>}
      {p.tipo === 'mayorista' && <Badge variant="outline">Mayorista</Badge>}
      {p.tipo === 'minorista' && <Badge variant="outline">Tienda en línea</Badge>}
    </div>
  )
}

function Despacho({ p }: { p: PedidoBodega }) {
  const foto = useFotoDeVariante()
  const despachar = useDespachar()
  const cancelar = useCancelarPedidoBodega()
  const [entregar, setEntregar] = useState<Record<string, number>>(() =>
    Object.fromEntries(p.lineas.map((l) => [l.id, Math.min(l.cantidad, Math.max(0, l.stock))])),
  )
  const total = p.lineas.reduce((s, l) => s + (entregar[l.id] ?? 0), 0)
  const invalido = p.lineas.some((l) => {
    const n = entregar[l.id] ?? 0
    return !Number.isInteger(n) || n < 0 || n > l.cantidad || n > l.stock
  })

  function enviar() {
    despachar.mutate(
      { id: p.id, lineas: p.lineas.map((l) => ({ detalleId: l.id, entregados: entregar[l.id] ?? 0 })) },
      { onSuccess: () => toast.success(`Entrega #${p.numero} despachada: ${total} pares`), onError: (e) => toast.error(mensajeError(e)) },
    )
  }

  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4">
      <Encabezado p={p} />
      {p.nota && <p className="rounded-md bg-muted p-3 text-sm">{p.nota}</p>}
      <ul className="divide-y divide-border">
        {p.lineas.map((l) => (
          <li key={l.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
            <FotoPar src={foto(l.variante_id)} alt={l.descripcion} className="aspect-square w-full rounded-xl sm:size-44 sm:w-44" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-display text-2xl font-bold uppercase leading-tight">{partesLinea(l.descripcion).nombre}</p>
                {partesLinea(l.descripcion).color && (
                  <p className="mt-1 flex items-center gap-3">
                    <span className="text-muted-foreground">{partesLinea(l.descripcion).color}</span>
                    <span className="rounded-lg bg-foreground px-3 py-1 text-xl font-bold tabular-nums text-background">Talla {partesLinea(l.descripcion).talla}</span>
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Pidió <strong className="text-lg text-foreground tabular-nums">{l.cantidad}</strong> · en bodega {l.stock}</p>
              <label className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Entregar</span>
                <Input
                  type="number"
                  min={0}
                  max={Math.min(l.cantidad, l.stock)}
                  inputMode="numeric"
                  className="h-12 w-24 text-right text-lg"
                  aria-label={`Pares a entregar de ${l.descripcion}`}
                  value={entregar[l.id] ?? 0}
                  onChange={(e) => setEntregar({ ...entregar, [l.id]: Number(e.target.value) })}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button disabled={despachar.isPending || invalido || total === 0} onClick={enviar}>
          {despachar.isPending ? 'Despachando…' : `Despachar ${total} pares`}
        </Button>
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={cancelar.isPending}
          onClick={() => cancelar.mutate(p.id, { onSuccess: () => toast.success('Pedido cancelado'), onError: (e) => toast.error(mensajeError(e)) })}
        >
          Cancelar pedido
        </Button>
      </div>
      {invalido && <p className="text-sm text-destructive">No se puede entregar más de lo pedido ni de lo que hay en bodega.</p>}
    </article>
  )
}

function PedidoWeb({ p }: { p: PedidoBodega }) {
  const foto = useFotoDeVariante()
  const entregar = useEntregarWeb()
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Encabezado p={p} />
      {p.cliente_direccion && <p className="text-sm"><span className="eyebrow mr-2">Dirección</span>{p.cliente_direccion}</p>}
      <ul className="divide-y divide-border">
        {p.lineas.map((l) => (
          <li key={l.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
            <FotoPar src={foto(l.variante_id)} alt={l.descripcion} className="aspect-square w-full rounded-xl sm:size-44 sm:w-44" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-bold uppercase leading-tight">{partesLinea(l.descripcion).nombre}</p>
              {partesLinea(l.descripcion).color && (
                <p className="mt-1 flex items-center gap-3">
                  <span className="text-muted-foreground">{partesLinea(l.descripcion).color}</span>
                  <span className="rounded-lg bg-foreground px-3 py-1 text-xl font-bold tabular-nums text-background">Talla {partesLinea(l.descripcion).talla}</span>
                </p>
              )}
            </div>
            <p className="text-sm text-muted-foreground sm:text-right">Pares <strong className="block text-4xl font-bold leading-none text-foreground tabular-nums">× {l.cantidad}</strong></p>
          </li>
        ))}
      </ul>
      <Button
        variant="solid"
        disabled={entregar.isPending}
        onClick={() => entregar.mutate(p.id, { onSuccess: () => toast.success(`Pedido #${p.numero} entregado`), onError: (e) => toast.error(mensajeError(e)) })}
      >
        Marcar entregado
      </Button>
    </article>
  )
}

function Historial({ p }: { p: PedidoBodega }) {
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Encabezado p={p} />
        <Badge variant={p.estado === 'liquidado' ? 'success' : 'neutral'}>{p.estado === 'liquidado' ? 'Cerrada' : 'Cancelada'}</Badge>
      </div>
      {p.estado === 'liquidado' && (
        <ul className="divide-y divide-border text-sm">
          {p.lineas.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-3 py-2">
              <span>{l.descripcion}</span>
              <span className="tabular-nums text-muted-foreground">
                Entregados {l.cantidad_entregada ?? 0} · vendidos <strong className="text-foreground">{l.cantidad_vendida ?? 0}</strong> · regresaron {l.cantidad_devuelta ?? 0}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** Encabezado de cada persona en el cierre: quién es y qué se le despachó en total. */
function ResumenGrupo({ nombre, rol, pedidos }: { nombre: string; rol: PedidoBodega['solicitante_rol']; pedidos: PedidoBodega[] }) {
  const resumen = useMemo(() => {
    const m = new Map<string, { entregados: number; vendidos: number; devueltos: number }>()
    for (const p of pedidos) {
      for (const l of p.lineas) {
        const e = l.cantidad_entregada ?? 0
        if (e === 0) continue
        const x = m.get(l.descripcion) ?? { entregados: 0, vendidos: 0, devueltos: 0 }
        x.entregados += e
        x.vendidos += l.cantidad_vendida ?? 0
        x.devueltos += l.cantidad_devuelta ?? 0
        m.set(l.descripcion, x)
      }
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [pedidos])
  const entregados = resumen.reduce((s, [, x]) => s + x.entregados, 0)
  const enPoder = resumen.reduce((s, [, x]) => s + x.entregados - x.vendidos - x.devueltos, 0)
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-3xl">{nombre}</h2>
        {rol && <Badge variant="outline">{NOMBRE_ROL[rol]}</Badge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {plural(pedidos.length, 'entrega abierta', 'entregas abiertas')} · {plural(entregados, 'par despachado', 'pares despachados')} ·{' '}
        <strong className="text-foreground tabular-nums">{plural(enPoder, 'par', 'pares')}</strong> en su poder
      </p>
      <details className="mt-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold">Qué se le despachó</summary>
        <ul className="mt-2 divide-y divide-border">
          {resumen.map(([descripcion, x]) => (
            <li key={descripcion} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>{descripcion}</span>
              <span className="tabular-nums text-muted-foreground">
                Despachados {x.entregados} · vendidos {x.vendidos} · regresaron {x.devueltos} · <strong className="text-foreground">en su poder {x.entregados - x.vendidos - x.devueltos}</strong>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

export function BodegaPage({ vista }: { vista: VistaBodega }) {
  const navigate = useNavigate()
  const { data = [], isLoading, error } = usePedidosBodega(vista)
  const [q, setQ] = useState('')
  const t = TEXTOS[vista]

  const filas = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? data.filter((p) => `${p.numero} ${p.solicitante_nombre ?? ''} ${p.cliente_nombre}`.toLowerCase().includes(s)) : data
  }, [data, q])

  // En el cierre se agrupa por solicitante (cada mayorista del sector o vendedor): se cuadra persona por persona.
  const grupos = useMemo(() => {
    const m = new Map<string, { nombre: string; rol: PedidoBodega['solicitante_rol']; pedidos: PedidoBodega[] }>()
    for (const p of filas) {
      const k = p.solicitante_id ?? p.cliente_nombre
      const g = m.get(k) ?? { nombre: p.solicitante_nombre ?? p.cliente_nombre, rol: p.solicitante_rol, pedidos: [] }
      g.pedidos.push(p)
      m.set(k, g)
    }
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))
  }, [filas])

  return (
    <>
      <PageHeader title={t.titulo} description={t.descripcion} />
      <Tabs
        className="mb-6"
        tabs={VISTAS.map((v) => ({ id: v.id, label: v.label }))}
        value={vista}
        onChange={(id) => navigate(VISTAS.find((v) => v.id === id)?.ruta ?? '/admin/bodega')}
      />
      {data.length > 3 && (
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número o nombre" aria-label="Buscar pedidos de bodega" className="mb-4 max-w-md" />
      )}
      {isLoading && <Skeleton className="h-48 w-full" />}
      {error && <p role="alert" className="text-destructive">{mensajeError(error)}</p>}
      {!isLoading && !error && filas.length === 0 && <EmptyState title="Todo al día" description={t.vacio} />}

      {vista === 'en_poder' ? (
        <div className="space-y-10">
          <PendientesCierre grupos={grupos.map(([clave, g]) => ({ clave, ...g }))} />
          {grupos.map(([clave, { nombre, rol, pedidos }]) => (
            <section key={clave} id={idCierre(clave)} aria-label={`Entregas de ${nombre}`} className="scroll-mt-24">
              <ResumenGrupo nombre={nombre} rol={rol} pedidos={pedidos} />
              <div className="space-y-4">
                {pedidos.map((p) => (
                  // La clave cambia si llegan ventas o devoluciones nuevas: así el formulario parte de los datos al día.
                  <CierreEntrega key={`${p.id}:${p.lineas.map((l) => `${l.cantidad_vendida}-${l.cantidad_devuelta}`).join(',')}`} pedido={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-4', vista !== 'historial' && 'xl:grid-cols-2')}>
          {filas.map((p) =>
            vista === 'por_despachar' ? <Despacho key={p.id} p={p} /> : vista === 'web' ? <PedidoWeb key={p.id} p={p} /> : <Historial key={p.id} p={p} />,
          )}
        </div>
      )}
    </>
  )
}
