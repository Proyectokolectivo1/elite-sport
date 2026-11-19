import { mensajeError } from '@/lib/errors'
import { crearOpcion, crearProducto, guardarTallasProducto, listarOpciones, type TablaOpciones } from '../api/catalogo'
import { normalizar, type FilaValidada } from './validacion'

export interface ResultadoFila {
  fila: number
  nombre: string
  ok: boolean
  error?: string
}

const TABLA: Record<'marca' | 'categoria' | 'estilo', TablaOpciones> = { marca: 'marcas', categoria: 'categorias', estilo: 'estilos' }

/** Crea los productos válidos uno por uno (con sus tallas). Una fila con error no detiene a las demás. */
export async function importarProductos(filas: FilaValidada[], alAvanzar: (hechas: number, total: number) => void): Promise<ResultadoFila[]> {
  const validas = filas.filter((f) => f.producto)
  const ids: Record<TablaOpciones, Map<string, string>> = { marcas: new Map(), categorias: new Map(), estilos: new Map() }
  for (const tabla of Object.keys(ids) as TablaOpciones[]) {
    for (const o of await listarOpciones(tabla)) ids[tabla].set(normalizar(o.nombre), o.id)
  }
  const idDe = async (tipo: 'marca' | 'categoria' | 'estilo', nombre: string | null): Promise<string | null> => {
    if (!nombre) return null
    const mapa = ids[TABLA[tipo]]
    const k = normalizar(nombre)
    const existente = mapa.get(k)
    if (existente) return existente
    const creada = await crearOpcion(TABLA[tipo], nombre)
    mapa.set(k, creada.id)
    return creada.id
  }

  const resultados: ResultadoFila[] = []
  for (const f of validas) {
    const p = f.producto
    if (!p) continue
    try {
      const id = await crearProducto({
        nombre: p.nombre,
        grupo: p.grupo,
        marca_id: await idDe('marca', p.marca),
        categoria_id: await idDe('categoria', p.categoria),
        estilo_id: await idDe('estilo', p.estilo),
        descripcion: p.descripcion,
        precio_publico: p.precio_publico,
        precio_mayorista: p.precio_mayorista,
        activo: p.activo,
        destacado: p.destacado,
      })
      try {
        await guardarTallasProducto(id, p.tallas)
        resultados.push({ fila: f.fila, nombre: p.nombre, ok: true })
      } catch (e) {
        resultados.push({ fila: f.fila, nombre: p.nombre, ok: false, error: `El producto se creó pero no sus tallas: ${mensajeError(e)}. Configúralas desde el producto.` })
      }
    } catch (e) {
      resultados.push({ fila: f.fila, nombre: p.nombre, ok: false, error: mensajeError(e) })
    }
    alAvanzar(resultados.length, validas.length)
  }
  return resultados
}
