import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError, Input, InputSugerencias, Label, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { useProductos, useTallas, useVariantes } from '@/features/catalogo/hooks/useCatalogo'
import { mensajeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { calcularLineas, paresPorCaja, totalUnidades } from '../calculo'
import { useCurvas, useRegistrarIngreso, useUltimoSurtido } from '../hooks/useInventario'

type Tipo = 'caja' | 'unidad'

export function IngresoForm({ productoInicial }: { productoInicial?: string }) {
  const { data: productos = [] } = useProductos()
  const { data: tallas = [] } = useTallas()
  const { data: curvas = [] } = useCurvas()
  const registrar = useRegistrarIngreso()

  const [tipo, setTipo] = useState<Tipo>('caja')
  const [productoId, setProductoId] = useState(productoInicial ?? '')
  const [color, setColor] = useState('')
  // 'auto': el surtido del último ingreso de este producto (si existe); 'personalizado'; o el id de una curva guardada.
  const [fuente, setFuente] = useState<string>('auto')
  const [cajas, setCajas] = useState('1')
  const [pares, setPares] = useState<Record<string, string>>({})
  const [totales, setTotales] = useState<Record<string, string>>({})
  const [proveedor, setProveedor] = useState('')
  const [referencia, setReferencia] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: variantesProducto = [] } = useVariantes(productoId)
  const coloresProducto = [...new Set(variantesProducto.map((v) => v.color))]
  const { data: ultimo } = useUltimoSurtido(productoId)

  const producto = productos.find((p) => p.id === productoId)
  const tallasGrupo = useMemo(() => tallas.filter((t) => t.grupo === producto?.grupo), [tallas, producto?.grupo])
  const curvasGrupo = curvas.filter((c) => c.grupo === producto?.grupo)
  const nCajas = tipo === 'caja' ? Number(cajas) : 1

  const paresEfectivos: Record<string, string> = useMemo(() => {
    if (fuente === 'personalizado') return pares
    if (fuente === 'auto') return ultimo ? Object.fromEntries(Object.entries(ultimo.pares).map(([k, v]) => [k, String(v)])) : pares
    const c = curvas.find((x) => x.id === fuente)
    return c ? Object.fromEntries(c.detalle.map((d) => [d.talla_id, String(d.pares)])) : pares
  }, [fuente, pares, ultimo, curvas])
  const valorFuente = fuente === 'auto' ? (ultimo ? 'ultimo' : 'personalizado') : fuente

  const lineas = useMemo(
    () =>
      calcularLineas(
        tallasGrupo.map((t) => ({
          tallaId: t.id,
          pares: Number(paresEfectivos[t.id] || 0),
          totalManual: totales[t.id] !== undefined && totales[t.id] !== '' ? Number(totales[t.id]) : tipo === 'unidad' ? 0 : undefined,
        })),
        nCajas,
      ),
    [tallasGrupo, paresEfectivos, totales, tipo, nCajas],
  )
  const total = totalUnidades(lineas)

  function elegirProducto(id: string) {
    setProductoId(id)
    setFuente('auto')
    setPares({})
    setTotales({})
  }

  function elegirFuente(valor: string) {
    setTotales({})
    if (valor === 'ultimo') setFuente('auto')
    else {
      setFuente(valor)
      if (valor === 'personalizado') setPares({})
    }
  }

  function validar(): string | null {
    if (!producto) return 'Elige un producto.'
    if (!color.trim()) return 'Indica el color.'
    if (tipo === 'caja' && (!Number.isInteger(nCajas) || nCajas < 1)) return 'El número de cajas debe ser al menos 1.'
    if (lineas.some((l) => !Number.isInteger(l.total) || l.total < 0)) return 'Hay cantidades no válidas.'
    if (total <= 0) return 'No hay unidades para ingresar.'
    return null
  }

  async function guardar() {
    const msg = validar()
    setError(msg)
    if (msg || !producto) return
    try {
      await registrar.mutateAsync({
        tipo,
        productoId: producto.id,
        cajas: nCajas,
        color: color.trim(),
        proveedor: proveedor.trim(),
        referencia: referencia.trim(),
        nota: nota.trim(),
        lineas: lineas.map((l) => ({ talla_id: l.tallaId, pares: tipo === 'caja' ? l.pares : l.total, total: l.total })),
      })
      toast.success(`Ingresaron ${total} pares de ${producto.nombre}`)
      setTotales({})
      setNota('')
      setReferencia('')
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div role="radiogroup" aria-label="Tipo de ingreso" className="inline-flex rounded-md border border-input p-1">
        {(['caja', 'unidad'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tipo === t}
            onClick={() => setTipo(t)}
            className={cn('h-10 rounded-sm px-5 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] transition-colors', tipo === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            {t === 'caja' ? 'Por caja' : 'Por unidad'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ing-producto">Producto</Label>
          <Select id="ing-producto" value={productoId} onChange={(e) => elegirProducto(e.target.value)}>
            <option value="">Elige un producto</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ing-color">Color</Label>
          <InputSugerencias id="ing-color" value={color} onChange={setColor} opciones={coloresProducto} placeholder="Ej. Negro" />
        </div>
        {tipo === 'caja' && (
          <>
            <div>
              <Label htmlFor="ing-curva">Surtido de la caja</Label>
              <Select id="ing-curva" value={valorFuente} onChange={(e) => elegirFuente(e.target.value)} disabled={!producto}>
                {ultimo && <option value="ultimo">Último ingreso de este producto</option>}
                {curvasGrupo.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
                <option value="personalizado">Personalizado</option>
              </Select>
              {valorFuente === 'ultimo' && ultimo && (
                <p className="mt-1 text-xs text-muted-foreground">Tomado del ingreso del {new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(ultimo.fecha))}. Puedes cambiarlo abajo.</p>
              )}
            </div>
            <div>
              <Label htmlFor="ing-cajas">Número de cajas</Label>
              <Input id="ing-cajas" type="number" min="1" step="1" inputMode="numeric" value={cajas} onChange={(e) => { setCajas(e.target.value); setTotales({}) }} />
            </div>
          </>
        )}
      </div>

      {producto && (
        <div>
          <Table>
            <THead>
              <TR>
                <TH>Talla</TH>
                {tipo === 'caja' && <TH className="text-right">Pares por caja</TH>}
                <TH className="text-right">{tipo === 'caja' ? 'Total a ingresar' : 'Unidades'}</TH>
              </TR>
            </THead>
            <TBody>
              {tallasGrupo.map((t) => {
                const l = lineas.find((x) => x.tallaId === t.id)
                return (
                  <TR key={t.id}>
                    <TD className="font-semibold tabular-nums">{t.etiqueta}</TD>
                    {tipo === 'caja' && (
                      <TD className="text-right">
                        <Input
                          aria-label={`Pares por caja, talla ${t.etiqueta}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          className="ml-auto h-9 w-24 text-right"
                          value={paresEfectivos[t.id] ?? ''}
                          placeholder="0"
                          onChange={(e) => {
                            setPares({ ...paresEfectivos, [t.id]: e.target.value })
                            setTotales((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== t.id)))
                            setFuente('personalizado')
                          }}
                        />
                      </TD>
                    )}
                    <TD className="text-right">
                      <Input
                        aria-label={`${tipo === 'caja' ? 'Total' : 'Unidades'}, talla ${t.etiqueta}`}
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className="ml-auto h-9 w-24 text-right"
                        value={totales[t.id] ?? (l && l.total > 0 ? String(l.total) : '')}
                        placeholder="0"
                        onChange={(e) => setTotales((o) => ({ ...o, [t.id]: e.target.value }))}
                      />
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">
            {tipo === 'caja' && <>Cada caja trae <strong className="text-foreground tabular-nums">{paresPorCaja(lineas)}</strong> pares. </>}
            Se ingresarán <strong className="text-foreground tabular-nums">{total}</strong> pares.
            {tipo === 'caja' && ' Puedes corregir el total de una talla si la caja llegó incompleta.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ing-prov">Proveedor</Label>
          <Input id="ing-prov" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ing-ref">Referencia o factura</Label>
          <Input id="ing-ref" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ing-nota">Nota</Label>
          <Textarea id="ing-nota" value={nota} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>

      <FieldError>{error ?? undefined}</FieldError>
      <Button size="lg" disabled={registrar.isPending} onClick={() => void guardar()}>
        {registrar.isPending ? 'Registrando…' : `Ingresar ${total > 0 ? total + ' pares' : 'mercancía'}`}
      </Button>
    </div>
  )
}
