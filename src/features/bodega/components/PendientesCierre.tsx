import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NOMBRE_ROL } from '@/features/auth/roles'
import { cn } from '@/lib/utils'
import type { PedidoBodega } from '../api/bodega'
import { usePedidosBodega } from '../hooks/useBodega'
import { pendiente } from '../logica'

export interface GrupoCierre {
  clave: string
  nombre: string
  rol: PedidoBodega['solicitante_rol']
  pedidos: PedidoBodega[]
}

const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })
const fecha = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Pares que aún tiene en su poder quien recibió esta entrega. */
export function paresEnPoder(p: PedidoBodega): number {
  return p.lineas.reduce(
    (s, l) => s + pendiente({ id: l.id, entregada: l.cantidad_entregada ?? 0, vendida: l.cantidad_vendida ?? 0, devuelta: l.cantidad_devuelta ?? 0 }),
    0,
  )
}

export const idCierre = (clave: string) => `cierre-${clave}`

/**
 * Control del cierre: quién debe cerrar hoy (con cuántos pares y desde cuándo) y quién ya cerró.
 * Una entrega de un día anterior se marca aparte: es la que más urge cuadrar.
 */
export function PendientesCierre({ grupos }: { grupos: GrupoCierre[] }) {
  const inicioHoy = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])
  const { data: historial = [] } = usePedidosBodega('historial')

  const pendientes = grupos.map((g) => {
    const salidas = g.pedidos.map((p) => (p.despachado_en ? new Date(p.despachado_en).getTime() : null)).filter((t): t is number => t !== null)
    const masAntigua = salidas.length ? Math.min(...salidas) : null
    return {
      ...g,
      enPoder: g.pedidos.reduce((s, p) => s + paresEnPoder(p), 0),
      masAntigua,
      anterior: masAntigua !== null && masAntigua < inicioHoy,
    }
  })
  const totalPares = pendientes.reduce((s, g) => s + g.enPoder, 0)

  const cerradosHoy = useMemo(() => {
    const m = new Map<string, { nombre: string; rol: PedidoBodega['solicitante_rol']; entregas: number; vendidos: number; devueltos: number; ultima: number }>()
    for (const p of historial) {
      if (p.estado !== 'liquidado' || p.tipo !== 'consignacion' || !p.liquidado_en) continue
      const t = new Date(p.liquidado_en).getTime()
      if (t < inicioHoy) continue
      const k = p.solicitante_id ?? p.cliente_nombre
      const x = m.get(k) ?? { nombre: p.solicitante_nombre ?? p.cliente_nombre, rol: p.solicitante_rol, entregas: 0, vendidos: 0, devueltos: 0, ultima: 0 }
      x.entregas += 1
      x.ultima = Math.max(x.ultima, t)
      for (const l of p.lineas) {
        x.vendidos += l.cantidad_vendida ?? 0
        x.devueltos += l.cantidad_devuelta ?? 0
      }
      m.set(k, x)
    }
    return [...m.values()].sort((a, b) => b.ultima - a.ultima)
  }, [historial, inicioHoy])

  if (pendientes.length === 0 && cerradosHoy.length === 0) return null

  return (
    <section aria-label="Control del cierre" className="space-y-5 rounded-xl border border-border bg-card/50 p-4">
      <div>
        <h2 className="text-2xl">Falta por cerrar</h2>
        <p className="text-sm text-muted-foreground">
          {pendientes.length === 0
            ? 'Nadie tiene entregas abiertas.'
            : `${plural(pendientes.length, 'persona debe', 'personas deben')} cerrar · ${plural(totalPares, 'par', 'pares')} por cuadrar entre vendidos y devueltos.`}
        </p>
      </div>

      {pendientes.length > 0 && (
        <ul className="divide-y divide-border">
          {pendientes.map((g) => (
            <li key={g.clave} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {g.nombre}
                  {g.rol && <Badge variant="outline">{NOMBRE_ROL[g.rol]}</Badge>}
                  {g.anterior && <Badge variant="warning">Entrega de un día anterior</Badge>}
                </p>
                <p className={cn('text-sm text-muted-foreground', g.anterior && 'text-foreground')}>
                  {plural(g.pedidos.length, 'entrega abierta', 'entregas abiertas')} ·{' '}
                  <strong className="tabular-nums text-foreground">{plural(g.enPoder, 'par', 'pares')}</strong> en su poder
                  {g.masAntigua !== null && <> · salió {g.anterior ? fecha.format(new Date(g.masAntigua)) : `a las ${hora.format(new Date(g.masAntigua))}`}</>}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => document.getElementById(idCierre(g.clave))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Ir al cierre
              </Button>
            </li>
          ))}
        </ul>
      )}

      {cerradosHoy.length > 0 && (
        <div>
          <h3 className="eyebrow mb-2">Ya cerraron hoy</h3>
          <ul className="divide-y divide-border text-sm">
            {cerradosHoy.map((c) => (
              <li key={c.nombre} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {c.nombre}
                  {c.rol && <Badge variant="outline">{NOMBRE_ROL[c.rol]}</Badge>}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {plural(c.entregas, 'entrega', 'entregas')} · vendidos <strong className="text-foreground">{c.vendidos}</strong> · regresaron {c.devueltos} · {hora.format(new Date(c.ultima))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
