import { COLUMNAS, HOJA_PRODUCTOS, MAX_FILAS, type FilaCruda } from './columnas'

export interface ListasPlantilla {
  marcas: string[]
  categorias: string[]
  estilos: string[]
}

const GRUPOS_LISTA = ['Dama', 'Caballero', 'Niño', 'Unisex']
const INSTRUCCIONES = [
  'Cómo llenar la plantilla',
  '',
  '1. Llena una fila por modelo en la hoja "Productos". Las columnas con * son obligatorias.',
  '2. Grupo: Dama, Caballero, Niño o Unisex.',
  '3. Marca, Categoría y Estilo: elige de la lista o escribe uno nuevo (se creará al importar). Si lo dejas vacío, el producto queda sin ese dato.',
  '4. Precio público y mayorista: solo el número, por ejemplo 45 o 45,50. El mayorista no puede superar al público.',
  '5. Talla desde / hasta: rango del modelo, por ejemplo 36 a 45. Si lo dejas vacío se usa el rango del grupo.',
  '6. Pares por talla en la caja: cuántos pares de cada talla trae la caja, con el formato 38:2, 39:2, 40:1. Las tallas que no escribas quedan en 0.',
  '7. Activo (Sí/No, por defecto Sí) y Destacado (Sí/No, por defecto No).',
  '8. No pongas inventario aquí: el stock se ingresa desde Inventario. Las fotos se suben desde la plataforma, en cada producto.',
  `9. Máximo ${MAX_FILAS} productos por archivo. Si un nombre ya existe en la plataforma, esa fila se rechaza para no duplicarlo.`,
  '',
  'Ejemplo (no lo copies tal cual):',
  'Nombre: Runner Pro | Grupo: Caballero | Marca: Adidas | Categoría: Deportivo | Estilo: Running | Precio público: 89,90 | Precio mayorista: 70 | Talla desde: 38 | Talla hasta: 45 | Pares: 38:1, 39:2, 40:2, 41:2, 42:2, 43:1',
]

/** Arma el archivo .xlsx de la plantilla, con listas desplegables y las instrucciones. exceljs se carga solo al usarlo. */
export async function construirPlantilla(listas: ListasPlantilla): Promise<Blob> {
  const { Workbook } = await import('exceljs')
  const libro = new Workbook()
  libro.creator = 'Elite Sport'

  const hoja = libro.addWorksheet(HOJA_PRODUCTOS, { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  const cabecera = hoja.getRow(1)
  cabecera.height = 24
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FF111111' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD7FF3A' } }
    celda.alignment = { vertical: 'middle', wrapText: true }
  })

  const ayuda = libro.addWorksheet('Instrucciones')
  ayuda.getColumn(1).width = 120
  INSTRUCCIONES.forEach((t, i) => {
    const celda = ayuda.getCell(i + 1, 1)
    celda.value = t
    celda.alignment = { wrapText: true, vertical: 'top' }
    if (i === 0) celda.font = { bold: true, size: 14 }
  })

  const listasHoja = libro.addWorksheet('Listas')
  const columnasListas: [string, string[]][] = [
    ['Marcas', listas.marcas],
    ['Categorías', listas.categorias],
    ['Estilos', listas.estilos],
  ]
  columnasListas.forEach(([titulo, valores], i) => {
    listasHoja.getCell(1, i + 1).value = titulo
    listasHoja.getCell(1, i + 1).font = { bold: true }
    listasHoja.getColumn(i + 1).width = 24
    valores.forEach((v, j) => {
      listasHoja.getCell(j + 2, i + 1).value = v
    })
  })

  const letra = (clave: (typeof COLUMNAS)[number]['clave']) => String.fromCharCode(65 + COLUMNAS.findIndex((c) => c.clave === clave))
  const rangoLista = (col: string, n: number) => `Listas!$${col}$2:$${col}$${Math.max(2, n + 1)}`
  for (let fila = 2; fila <= MAX_FILAS + 1; fila++) {
    hoja.getCell(`${letra('grupo')}${fila}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${GRUPOS_LISTA.join(',')}"`], showErrorMessage: true, errorTitle: 'Grupo', error: 'Elige Dama, Caballero, Niño o Unisex.' }
    // Marca, categoría y estilo aceptan valores nuevos: la lista solo sugiere.
    const sugerencias: [ReturnType<typeof letra>, string, number][] = [
      [letra('marca'), 'A', listas.marcas.length],
      [letra('categoria'), 'B', listas.categorias.length],
      [letra('estilo'), 'C', listas.estilos.length],
    ]
    for (const [col, origen, n] of sugerencias) {
      hoja.getCell(`${col}${fila}`).dataValidation = { type: 'list', allowBlank: true, formulae: [rangoLista(origen, n)], showErrorMessage: false }
    }
    for (const clave of ['activo', 'destacado'] as const) {
      hoja.getCell(`${letra(clave)}${fila}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Sí,No"'], showErrorMessage: true, errorTitle: 'Sí o No', error: 'Elige Sí o No.' }
    }
  }
  return new Blob([await libro.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

type Valor = import('exceljs').CellValue

function textoDeCelda(v: Valor | undefined): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('').trim()
    if ('result' in v) return textoDeCelda(v.result as Valor)
    if ('text' in v) return String(v.text).trim()
    return ''
  }
  return String(v).trim()
}

/** Lee la hoja "Productos" de un .xlsx. Salta las filas vacías; el número de fila es el de Excel. */
export async function leerPlantilla(datos: ArrayBuffer): Promise<FilaCruda[]> {
  const { Workbook } = await import('exceljs')
  const libro = new Workbook()
  await libro.xlsx.load(datos)
  const hoja = libro.getWorksheet(HOJA_PRODUCTOS) ?? libro.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene hojas')
  const cab = textoDeCelda(hoja.getRow(1).getCell(1).value)
  if (!/^nombre/i.test(cab)) throw new Error('No es la plantilla de Elite Sport: la primera columna debe ser "Nombre". Descarga la plantilla y vuelve a intentarlo.')

  const filas: FilaCruda[] = []
  hoja.eachRow((fila, n) => {
    if (n === 1) return
    const f = { fila: n } as FilaCruda
    COLUMNAS.forEach((c, i) => {
      f[c.clave] = textoDeCelda(fila.getCell(i + 1).value)
    })
    if (COLUMNAS.some((c) => f[c.clave] !== '')) filas.push(f)
  })
  return filas
}
