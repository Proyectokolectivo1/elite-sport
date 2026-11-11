import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import type { EstadoPerfil } from '../api/mayoristas'
import { useCambiarEstado, useMayoristas } from '../hooks/useMayoristas'

const ESTADOS: Record<EstadoPerfil, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', suspendido: 'Suspendido' }
const TONO: Record<EstadoPerfil, 'signal' | 'success' | 'destructive' | 'warning'> = { pendiente: 'signal', aprobado: 'success', rechazado: 'destructive', suspendido: 'warning' }
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' })
const diasHasta = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

export function MayoristasPage() {
  const { data = [], isLoading } = useMayoristas()
  const cambiar = useCambiarEstado()
  const [filtro, setFiltro] = useState<EstadoPerfil | 'todos'>('pendiente')

  const filas = filtro === 'todos' ? data : data.filter((m) => m.estado === filtro)
  const pendientes = data.filter((m) => m.estado === 'pendiente').length

  function aplicar(id: string, estado: EstadoPerfil, mensaje: string) {
    cambiar.mutate({ id, estado }, { onSuccess: () => toast.success(mensaje), onError: (e) => toast.error(mensajeError(e)) })
  }

  return (
    <>
      <PageHeader title="Mayoristas" description="Al aprobar a un mayorista se activa su sección de tienda. Suspenderlo la desactiva." />
      <Tabs
        className="mb-6"
        value={filtro}
        onChange={setFiltro}
        tabs={[
          { id: 'pendiente', label: `Pendientes${pendientes ? ` (${pendientes})` : ''}` },
          { id: 'aprobado', label: 'Aprobados' },
          { id: 'suspendido', label: 'Suspendidos' },
          { id: 'rechazado', label: 'Rechazados' },
          { id: 'todos', label: 'Todos' },
        ]}
      />
      {isLoading && <Skeleton className="h-48 w-full" />}
      {!isLoading && filas.length === 0 && <EmptyState title="Nada por aquí" description="Los mayoristas se registran desde la página pública de registro." />}
      {filas.length > 0 && (
        <Table>
          <THead>
            <TR><TH>Negocio</TH><TH>Contacto</TH><TH>Ciudad</TH><TH>Estado</TH><TH>Pedidos</TH><TH><span className="sr-only">Acciones</span></TH></TR>
          </THead>
          <TBody>
            {filas.map((m) => (
              <TR key={m.id}>
                <TD className="font-semibold">
                  {m.negocio || m.nombre}
                  <span className="block text-xs font-normal text-muted-foreground">{m.nombre}{m.cedulaRuc ? ` · ${m.cedulaRuc}` : ''}</span>
                </TD>
                <TD>{m.telefono ?? 'Sin dato'}{m.correo && <a href={`mailto:${m.correo}`} className="block break-all text-xs text-muted-foreground underline-offset-4 hover:underline">{m.correo}</a>}</TD>
                <TD>{m.ciudad ?? 'Sin dato'}</TD>
                <TD>
                  <Badge variant={TONO[m.estado]}>{m.estado === 'suspendido' && m.motivo === 'inactividad' ? 'Inactivo' : ESTADOS[m.estado]}</Badge>
                  {m.slug && m.estado === 'aprobado' && <Link to={`/t/${m.slug}`} className="mt-1 block text-xs underline underline-offset-4">/t/{m.slug}</Link>}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {m.estado === 'aprobado' && m.venceEn ? (
                    <>
                      {m.ultimoPedido ? `Último: ${fecha.format(new Date(m.ultimoPedido))}` : 'Sin pedidos aún'}
                      <span className={`block text-xs ${diasHasta(m.venceEn) <= 7 ? 'text-warning' : ''}`}>Se bloquea en {Math.max(0, diasHasta(m.venceEn))} días</span>
                    </>
                  ) : m.estado === 'suspendido' && m.motivo === 'inactividad' ? (
                    <span className="text-xs">Bloqueado por no hacer pedidos</span>
                  ) : (
                    fecha.format(new Date(m.creadoEn))
                  )}
                </TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    {(m.estado === 'pendiente' || m.estado === 'rechazado' || m.estado === 'suspendido') && (
                      <Button size="sm" disabled={cambiar.isPending} onClick={() => aplicar(m.id, 'aprobado', 'Mayorista aprobado')}>Aprobar</Button>
                    )}
                    {m.estado === 'pendiente' && <Button size="sm" variant="outline" disabled={cambiar.isPending} onClick={() => aplicar(m.id, 'rechazado', 'Solicitud rechazada')}>Rechazar</Button>}
                    {m.estado === 'aprobado' && <Button size="sm" variant="outline" disabled={cambiar.isPending} onClick={() => aplicar(m.id, 'suspendido', 'Mayorista suspendido')}>Suspender</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
