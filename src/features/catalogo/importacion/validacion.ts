import { RANGO_POR_GRUPO } from '../tallasModelo'
import type { FilaCruda } from './columnas'

export type GrupoImport = 'dama' | 'caballero' | 'nino' | 'unisex'

export interface ProductoImportable {
  nombre: string
  grupo: GrupoImport
  marca: string | null
  categoria: string | null
  estilo: string | null
  descripcion: string | null
  precio_publico: number
  precio_mayorista: number | null
  tallas: { etiqueta: string; pares: number }[]
  activo: boolean
  destacado: boolean
}

export interface FilaValidada {
  fila: number
  nombre: string
  errores: string[]
  producto: ProductoImportable | null
  /** Marca, categoría o estilo que todavía no existen y se crearían al importar. */
  nuevas: { tipo: 'marca' | 'categoria' | 'estilo'; nombre: string }[]
}

export interface CatalogoExistente {
  marcas: string[]
  categorias: string[]
  estilos: string[]
  /** Nombres de productos que ya existen (para no duplicarlos). */
  productos: string[]
}

/** Minúsculas y sin acentos, para comparar nombres. */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const GRUPOS: Record<string, GrupoImport> = {
  dama: 'dama',
  mujer: 'dama',
  caballero: 'caballero',
  hombre: 'caballero',
  nino: 'nino',
  nina: 'nino',
  ninos: 'nino',
  unisex: 'unisex',
}

function numero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '').replace(/^\$/, '')
  if (t === '') return null
  const limpio = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return Number.NaN
  return Number(limpio)
}

function sino(texto: string, porDefecto: boolean): boolean | null {
  const t = normalizar(texto)
  if (t === '') return porDefecto
  if (['si', 's', 'yes', 'y', '1', 'true', 'x'].includes(t)) return true
  if (['no', 'n', '0', 'false'].includes(t)) return false
  return null
}

/** "38:2, 39=2; 40 1" se lee como { 38: 2, 39: 2, 40: 1 }. Devuelve el error si el formato no se entiende. */
export function leerPares(texto: string): { pares: Record<string, number>; error: string | null } {
  const pares: Record<string, number> = {}
  for (const trozo of texto.split(/[,;\n]+/)) {
    const t = trozo.trim()
    if (!t) continue
    const m = /^(\d{1,2}(?:\.5)?)\s*[:=\s]\s*(\d+)$/.exec(t)
    if (!m) return { pares, error: `Pares por talla no válidos: "${t}". Usa el formato 38:2, 39:2` }
    const n = Number(m[2])
    if (n > 100) return { pares, error: `Máximo 100 pares por talla (talla ${m[1]})` }
    pares[m[1]] = n
  }
  return { pares, error: null }
}

export function validarFilas(filas: FilaCruda[], catalogo: CatalogoExistente): FilaValidada[] {
  const existentes = new Set(catalogo.productos.map(normalizar))
  const enArchivo = new Map<string, number>()
  const buscar = (lista: string[], nombre: string) => lista.find((x) => normalizar(x) === normalizar(nombre))

  return filas.map((f) => {
    const errores: string[] = []
    const nuevas: FilaValidada['nuevas'] = []
    const nombre = f.nombre.trim()
    if (nombre.length < 2) errores.push('Falta el nombre del producto')
    else {
      const k = normalizar(nombre)
      if (existentes.has(k)) errores.push('Ya existe un producto con ese nombre')
      const previa = enArchivo.get(k)
      if (previa !== undefined) errores.push(`Nombre repetido (también en la fila ${previa})`)
      else enArchivo.set(k, f.fila)
    }

    const grupo = GRUPOS[normalizar(f.grupo)]
    if (!grupo) errores.push('Grupo no válido: usa Dama, Caballero, Niño o Unisex')

    const opcion = (tipo: 'marca' | 'categoria' | 'estilo', texto: string, lista: string[]): string | null => {
      const t = texto.trim()
      if (!t) return null
      const existente = buscar(lista, t)
      if (!existente) nuevas.push({ tipo, nombre: t })
      return existente ?? t
    }
    const marca = opcion('marca', f.marca, catalogo.marcas)
    const categoria = opcion('categoria', f.categoria, catalogo.categorias)
    const estilo = opcion('estilo', f.estilo, catalogo.estilos)

    const descripcion = f.descripcion.trim()
    if (descripcion.length > 2000) errores.push('La descripción pasa de 2000 caracteres')

    const publico = numero(f.precio_publico)
    if (publico === null) errores.push('Falta el precio público')
    else if (Number.isNaN(publico) || publico < 0) errores.push('Precio público no válido')
    const mayorista = numero(f.precio_mayorista)
    if (mayorista !== null && (Number.isNaN(mayorista) || mayorista < 0)) errores.push('Precio mayorista no válido')
    else if (mayorista !== null && publico !== null && !Number.isNaN(publico) && mayorista > publico) {
      errores.push('El precio mayorista no puede superar el público')
    }

    const tallas: { etiqueta: string; pares: number }[] = []
    if (grupo) {
      const rango = RANGO_POR_GRUPO[grupo]
      const desde = numero(f.talla_desde) ?? rango.desde
      const hasta = numero(f.talla_hasta) ?? rango.hasta
      if ([desde, hasta].some((x) => !Number.isInteger(x) || x < 10 || x > 60)) errores.push('Las tallas deben ser enteras entre 10 y 60')
      else if (desde > hasta) errores.push('La talla desde no puede ser mayor que la talla hasta')
      else if (hasta - desde >= 40) errores.push('Máximo 40 tallas por modelo')
      else {
        const { pares, error } = leerPares(f.pares)
        if (error) errores.push(error)
        else {
          const fuera = Object.keys(pares).filter((t) => Number(t) < desde || Number(t) > hasta)
          if (fuera.length > 0) errores.push(`Talla fuera del rango ${desde} a ${hasta}: ${fuera.join(', ')}`)
          for (let t = desde; t <= hasta; t++) tallas.push({ etiqueta: String(t), pares: pares[String(t)] ?? 0 })
        }
      }
    }

    const activo = sino(f.activo, true)
    if (activo === null) errores.push('Activo debe ser Sí o No')
    const destacado = sino(f.destacado, false)
    if (destacado === null) errores.push('Destacado debe ser Sí o No')

    if (errores.length > 0 || !grupo || publico === null || activo === null || destacado === null) {
      return { fila: f.fila, nombre, errores, producto: null, nuevas }
    }
    return {
      fila: f.fila,
      nombre,
      errores,
      nuevas,
      producto: {
        nombre,
        grupo,
        marca,
        categoria,
        estilo,
        descripcion: descripcion || null,
        precio_publico: publico,
        precio_mayorista: mayorista,
        tallas,
        activo,
        destacado,
      },
    }
  })
}
