import { useEffect, useMemo, useState } from 'react'
import { Store, UserPlus } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { etiquetaRol, NOMBRE_ROL } from '@/features/auth/roles'
import { mensajeError } from '@/lib/errors'
import type { Integrante } from '../api/bodega'
import { Locales, SelectorLocal } from './Locales'
import { EliminarUsuario, NuevoUsuario, RestablecerContrasena } from './NuevoUsuario'
import { useActualizarIntegrante, useEquipo } from '../hooks/useBodega'
import { integranteSchema, type IntegranteValues } from '../schemas'

const ROLES: { id: IntegranteValues['rol']; texto: string }[] = [
  { id: 'mayorista', texto: 'Compra en firme y tiene su sección /t/slug.' },
  { id: 'mayorista_sector', texto: 'Retira pares en bodega y liquida al cierre del día. Sin sección propia.' },
  { id: 'bodeguero', texto: 'Trabaja solo con la bodega y la tienda principal de Elite Sport: despacha, cierra el día e ingresa mercancía. No ve precios, ventas ni tiendas de mayoristas.' },
  { id: 'auxiliar_bodega', texto: 'Apoya al bodeguero: ve en vivo los pedidos que llegan a bodega, lo despachado y lo que está en poder de cada uno, para avisarle. No despacha, no cierra ni cambia nada.' },
  { id: 'vendedor', texto: 'Trabaja en un local (Élite, KZ, Mega Moda...): pide pares a bodega y arma las ventas de su local. No ve precios mayoristas ni pedidos de otros.' },
]
const ESTADOS: Record<IntegranteValues['estado'], string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', suspendido: 'Suspendido' }
const TONO: Record<IntegranteValues['estado'], 'warning' | 'success' | 'neutral' | 'destructive'> = { pendiente: 'warning', aprobado: 'success', rechazado: 'neutral', suspendido: 'destructive' }

function valoresDe(i: Integrante): IntegranteValues {
  return { rol: i.rol === 'admin' ? 'mayorista' : i.rol, estado: i.estado, local_id: i.localId ?? '' }
}

function Editar({ integrante, onListo }: { integrante: Integrante; onListo: () => void }) {
  const guardar = useActualizarIntegrante()
  const { register, handleSubmit, reset, control, formState: { errors, isDirty } } = useForm<IntegranteValues>({
    resolver: zodResolver(integranteSchema),
    defaultValues: valoresDe(integrante),
  })
  useEffect(() => reset(valoresDe(integrante)), [integrante, reset])
  const rol = useWatch({ control, name: 'rol' })

  function onSubmit(v: IntegranteValues) {
    guardar.mutate(
      { id: integrante.id, valores: v },
      { onSuccess: () => { toast.success('Cambios guardados'); onListo() }, onError: (e) => toast.error(mensajeError(e)) },
    )
  }

  return (
    <div className="space-y-6">
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <dl className="grid gap-2 text-sm">
        {integrante.correo && <div><dt className="eyebrow">Correo</dt><dd className="break-all">{integrante.correo}</dd></div>}
        {integrante.telefono && <div><dt className="eyebrow">Celular</dt><dd>{integrante.telefono}</dd></div>}
      </dl>
      <div>
        <Label htmlFor="eq-rol">Rol</Label>
        <Select id="eq-rol" {...register('rol')}>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{NOMBRE_ROL[r.id]}</option>)}
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">{ROLES.find((r) => r.id === rol)?.texto}</p>
        <FieldError>{errors.rol?.message}</FieldError>
      </div>
      {rol === 'vendedor' && <SelectorLocal id="eq-local" registro={register('local_id')} error={errors.local_id?.message} />}
      <div>
        <Label htmlFor="eq-estado">Estado</Label>
        <Select id="eq-estado" {...register('estado')}>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <FieldError>{errors.estado?.message}</FieldError>
      </div>
      {integrante.rol === 'mayorista' && rol !== 'mayorista' && (
        <p className="rounded-md bg-warning/10 p-3 text-sm">Al cambiar de rol, su sección /t/slug deja de verse.</p>
      )}
      <Button type="submit" className="w-full" disabled={!isDirty || guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
    </form>
      <RestablecerContrasena id={integrante.id} nombre={integrante.nombre} />
      <EliminarUsuario id={integrante.id} nombre={integrante.nombre} onListo={() => { toast.success('Usuario eliminado'); onListo() }} />
    </div>
  )
}

export function EquipoPage() {
  const { data = [], isLoading, error } = useEquipo()
  const [q, setQ] = useState('')
  const [rol, setRol] = useState('')
  const [abierto, setAbierto] = useState<Integrante | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [locales, setLocales] = useState(false)

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter((p) => (!rol || p.rol === rol) && (!t || `${p.nombre} ${p.negocio ?? ''} ${p.correo ?? ''} ${p.local ?? ''}`.toLowerCase().includes(t)))
  }, [data, q, rol])

  return (
    <>
      <PageHeader
        title="Equipo"
        description="Quien se registra entra como mayorista pendiente. Solo el administrador de Elite Sport asigna roles y crea cuentas con acceso: bodeguero, auxiliar de bodega, vendedor de un local o mayorista del sector."
        actions={
          <>
            <Button variant="outline" onClick={() => setLocales(true)}><Store /> Locales</Button>
            <Button onClick={() => setNuevo(true)}><UserPlus /> Nuevo usuario</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, negocio, correo o local" aria-label="Buscar personas" />
        <Select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Filtrar por rol">
          <option value="">Todos los roles</option>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{NOMBRE_ROL[r.id]}</option>)}
        </Select>
      </div>
      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <p role="alert" className="text-destructive">{mensajeError(error)}</p>}
      {!isLoading && filas.length === 0 && <EmptyState title="Sin personas" description="Cuando alguien se registre, aparecerá aquí." />}
      {filas.length > 0 && (
        <Table>
          <THead><TR><TH>Nombre</TH><TH>Rol</TH><TH>Estado</TH><TH><span className="sr-only">Acciones</span></TH></TR></THead>
          <TBody>
            {filas.map((p) => (
              <TR key={p.id}>
                <TD>{p.nombre || 'Sin nombre'}<span className="block text-xs text-muted-foreground">{p.negocio || p.correo}</span></TD>
                <TD>{etiquetaRol(p.rol, p.local)}</TD>
                <TD><Badge variant={TONO[p.estado]}>{ESTADOS[p.estado]}</Badge></TD>
                <TD className="text-right"><Button size="sm" variant="outline" onClick={() => setAbierto(p)}>Editar</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Sheet open={nuevo} onOpenChange={setNuevo}>
        {nuevo && (
          <SheetContent title="Nuevo usuario" description="Crea la cuenta ya aprobada y con su rol. Tú defines la contraseña temporal.">
            <NuevoUsuario onListo={() => setNuevo(false)} />
          </SheetContent>
        )}
      </Sheet>
      <Sheet open={locales} onOpenChange={setLocales}>
        {locales && (
          <SheetContent title="Locales" description="Cada vendedor pertenece a un local. Así la caja y la bodega saben de qué local es cada venta y cada pedido.">
            <Locales />
          </SheetContent>
        )}
      </Sheet>
      <Sheet open={!!abierto} onOpenChange={(o) => !o && setAbierto(null)}>
        {abierto && (
          <SheetContent title={abierto.nombre || 'Persona'} description={abierto.negocio ?? undefined}>
            <Editar integrante={abierto} onListo={() => setAbierto(null)} />
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}
