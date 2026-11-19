import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import { listarOpciones, listarProductosAdmin } from '../api/catalogo'
import { catalogoKeys } from '../hooks/useCatalogo'
import { MAX_FILAS } from '../importacion/columnas'
import { importarProductos, type ResultadoFila } from '../importacion/importar'
import { construirPlantilla, leerPlantilla } from '../importacion/plantilla'
import { validarFilas, type FilaValidada } from '../importacion/validacion'

const NOMBRE_GRUPO = { dama: 'Dama', caballero: 'Caballero', nino: 'Niño', unisex: 'Unisex' } as const
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Carga masiva de productos desde una plantilla de Excel. Las fotos se suben después, desde cada producto. */
export function ImportarProductosPage() {
  const moneda = useMoneyStore((s) => s.config)
  const qc = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [descargando, setDescargando] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [archivo, setArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaValidada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null)

  const validas = useMemo(() => (filas ?? []).filter((f) => f.producto), [filas])
  const conError = (filas ?? []).length - validas.length
  const nuevas = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of validas) for (const n of f.nuevas) m.set(`${n.tipo}:${n.nombre.toLowerCase()}`, `${n.tipo === 'marca' ? 'Marca' : n.tipo === 'categoria' ? 'Categoría' : 'Estilo'}: ${n.nombre}`)
    return [...m.values()]
  }, [validas])

  async function descargar() {
    setDescargando(true)
    try {
      const [marcas, categorias, estilos] = await Promise.all([listarOpciones('marcas'), listarOpciones('categorias'), listarOpciones('estilos')])
      const blob = await construirPlantilla({ marcas: marcas.map((o) => o.nombre), categorias: categorias.map((o) => o.nombre), estilos: estilos.map((o) => o.nombre) })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla-productos-elite-sport.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setDescargando(false)
    }
  }

  async function leer(file: File) {
    setError(null)
    setFilas(null)
    setResultados(null)
    setArchivo(file.name)
    setLeyendo(true)
    try {
      const crudas = await leerPlantilla(await file.arrayBuffer())
      if (crudas.length === 0) throw new Error('La plantilla no tiene productos. Llena al menos una fila.')
      if (crudas.length > MAX_FILAS) throw new Error(`El archivo trae ${crudas.length} filas. El máximo es ${MAX_FILAS} por carga.`)
      const [marcas, categorias, estilos, productos] = await Promise.all([
        listarOpciones('marcas'),
        listarOpciones('categorias'),
        listarOpciones('estilos'),
        listarProductosAdmin(),
      ])
      setFilas(
        validarFilas(crudas, {
          marcas: marcas.map((o) => o.nombre),
          categorias: categorias.map((o) => o.nombre),
          estilos: estilos.map((o) => o.nombre),
          productos: productos.map((p) => p.nombre),
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo. Usa un .xlsx descargado de esta página.')
    } finally {
      setLeyendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function importar() {
    if (!filas) return
    setProgreso({ hechas: 0, total: validas.length })
    try {
      const r = await importarProductos(filas, (hechas, total) => setProgreso({ hechas, total }))
      setResultados(r)
      const creados = r.filter((x) => x.ok).length
      if (creados > 0) toast.success(`${plural(creados, 'producto creado', 'productos creados')}.`)
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['productos-admin'] })
      void qc.invalidateQueries({ queryKey: ['opciones'] })
      void qc.invalidateQueries({ queryKey: ['catalogo-publico'] })
      setFilas(null)
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setProgreso(null)
    }
  }

  const importando = progreso !== null

  return (
    <>
      <PageHeader
        title="Importar productos"
        description="Sube muchos productos de una vez desde una plantilla de Excel. Las fotos se agregan después, desde cada producto."
        actions={
          <Link to="/admin/productos" className={cn(buttonVariants({ variant: 'outline' }))}>
            <ArrowLeft /> Productos
          </Link>
        }
      />

      <ol className="mb-8 grid gap-4 md:grid-cols-2">
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="eyebrow">Paso 1</p>
          <h2 className="mt-1 text-2xl">Descarga la plantilla</h2>
          <p className="mt-1 text-sm text-muted-foreground">Trae listas desplegables con tus marcas, categorías y estilos, y una hoja de instrucciones.</p>
          <Button className="mt-3" onClick={() => void descargar()} disabled={descargando}>
            <Download /> {descargando ? 'Preparando…' : 'Descargar plantilla (.xlsx)'}
          </Button>
        </li>
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="eyebrow">Paso 2</p>
          <h2 className="mt-1 text-2xl">Sube la plantilla llena</h2>
          <p className="mt-1 text-sm text-muted-foreground">Revisaremos cada fila antes de crear nada. Máximo {MAX_FILAS} productos por archivo.</p>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx"
            className="sr-only"
            aria-label="Archivo de plantilla"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void leer(f)
            }}
          />
          <Button className="mt-3" variant="outline" onClick={() => entrada.current?.click()} disabled={leyendo || importando}>
            <Upload /> {leyendo ? 'Revisando…' : 'Elegir archivo'}
          </Button>
          {archivo && <p className="mt-2 text-sm text-muted-foreground">{archivo}</p>}
        </li>
      </ol>

      {error && <p role="alert" className="mb-6 rounded-lg border border-destructive p-3 text-destructive">{error}</p>}

      {filas && (
        <section aria-label="Revisión" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              <strong className="font-display text-3xl tabular-nums">{validas.length}</strong> {validas.length === 1 ? 'producto listo' : 'productos listos'}
              {conError > 0 && (
                <>
                  {' '}· <strong className="text-destructive">{plural(conError, 'fila con error', 'filas con error')}</strong> (no se importarán)
                </>
              )}
            </p>
            <Button onClick={() => void importar()} disabled={validas.length === 0 || importando}>
              {importando ? `Importando ${progreso.hechas} de ${progreso.total}…` : `Importar ${plural(validas.length, 'producto', 'productos')}`}
            </Button>
          </div>
          {nuevas.length > 0 && (
            <p className="rounded-lg bg-warning/10 p-3 text-sm">
              Se crearán estos datos nuevos: {nuevas.join(' · ')}.
            </p>
          )}
          <Table>
            <THead>
              <TR>
                <TH>Fila</TH>
                <TH>Producto</TH>
                <TH>Grupo</TH>
                <TH className="text-right">Público</TH>
                <TH className="text-right">Mayorista</TH>
                <TH>Tallas</TH>
                <TH>Estado</TH>
              </TR>
            </THead>
            <TBody>
              {filas.map((f) => (
                <TR key={f.fila}>
                  <TD className="tabular-nums">{f.fila}</TD>
                  <TD className="font-semibold">{f.nombre || '—'}</TD>
                  <TD>{f.producto ? NOMBRE_GRUPO[f.producto.grupo] : ''}</TD>
                  <TD className="text-right tabular-nums">{f.producto ? formatMoney(f.producto.precio_publico, moneda) : ''}</TD>
                  <TD className="text-right tabular-nums">{f.producto?.precio_mayorista != null ? formatMoney(f.producto.precio_mayorista, moneda) : ''}</TD>
                  <TD className="tabular-nums">
                    {f.producto ? `${f.producto.tallas[0]?.etiqueta}–${f.producto.tallas[f.producto.tallas.length - 1]?.etiqueta}` : ''}
                  </TD>
                  <TD>
                    {f.errores.length === 0 ? (
                      <Badge variant="success">Listo</Badge>
                    ) : (
                      <ul className="space-y-0.5 text-sm text-destructive">
                        {f.errores.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}

      {resultados && (
        <section aria-label="Resultado" className="space-y-3">
          <h2 className="text-3xl">Resultado</h2>
          <p>
            <strong className="tabular-nums">{resultados.filter((r) => r.ok).length}</strong> creados
            {resultados.some((r) => !r.ok) && (
              <>
                {' '}· <strong className="text-destructive tabular-nums">{resultados.filter((r) => !r.ok).length}</strong> con problemas
              </>
            )}
            . Ahora sube las fotos y registra el inventario de cada producto.
          </p>
          {resultados.filter((r) => !r.ok).length > 0 && (
            <ul className="space-y-1 text-sm text-destructive">
              {resultados
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.fila}>Fila {r.fila} · {r.nombre}: {r.error}</li>
                ))}
            </ul>
          )}
          <Link to="/admin/productos" className={cn(buttonVariants())}>Ir a Productos</Link>
        </section>
      )}
    </>
  )
}
