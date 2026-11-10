import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import type { MotivoMovimiento } from '../api/inventario'
import { useMovimientos } from '../hooks/useInventario'

const MOTIVOS: Record<MotivoMovimiento, string> = {
  ingreso: 'Ingreso',
  venta: 'Venta',
  pedido_mayorista: 'Pedido mayorista',
  ajuste: 'Ajuste',
  anulacion: 'Anulación',
}

const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

export function MovimientosTab() {
  const { data = [], isLoading } = useMovimientos()
  const [motivo, setMotivo] = useState('')
  const [q, setQ] = useState('')

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter((m) => (!motivo || m.motivo === motivo) && (!t || `${m.producto} ${m.color} ${m.nota ?? ''}`.toLowerCase().includes(t)))
  }, [data, motivo, q])

  if (isLoading) return <Skeleton className="h-64 w-full" />
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto, color o nota" aria-label="Buscar movimientos" />
        <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Filtrar por motivo">
          <option value="">Todos los motivos</option>
          {Object.entries(MOTIVOS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>
      {filas.length === 0 ? (
        <EmptyState title="Sin movimientos" description="Cada ingreso, venta, ajuste y anulación queda registrado aquí." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Fecha</TH>
              <TH>Producto</TH>
              <TH>Talla</TH>
              <TH>Motivo</TH>
              <TH className="text-right">Cambio</TH>
              <TH>Nota</TH>
            </TR>
          </THead>
          <TBody>
            {filas.map((m) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap text-muted-foreground">{fecha.format(new Date(m.creadoEn))}</TD>
                <TD>{m.producto}<span className="block text-xs text-muted-foreground">{m.color}</span></TD>
                <TD className="tabular-nums">{m.talla}</TD>
                <TD><Badge variant={m.delta > 0 ? 'success' : 'neutral'}>{MOTIVOS[m.motivo]}</Badge></TD>
                <TD className={`text-right font-semibold tabular-nums ${m.delta > 0 ? 'text-success' : 'text-destructive'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</TD>
                <TD className="max-w-[16rem] truncate text-muted-foreground">{m.nota}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  )
}
