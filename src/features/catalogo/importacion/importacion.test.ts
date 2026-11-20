import { describe, expect, it } from 'vitest'
import { COLUMNAS, type FilaCruda } from './columnas'
import { construirPlantilla, leerPlantilla } from './plantilla'
import { leerPares, validarFilas, type CatalogoExistente } from './validacion'

const catalogo: CatalogoExistente = {
  marcas: ['Adidas', 'Nike'],
  categorias: ['Deportivo'],
  estilos: ['Running'],
  productos: ['Foce one negro'],
}

const fila = (n: number, p: Partial<FilaCruda>): FilaCruda => ({
  fila: n, nombre: '', grupo: '', marca: '', categoria: '', estilo: '', descripcion: '', precio_publico: '', precio_mayorista: '',
  talla_desde: '', talla_hasta: '', pares: '', activo: '', destacado: '', ...p,
})

describe('plantilla de productos', () => {
  it('se genera, se vuelve a leer y conserva el orden de las columnas', async () => {
    const blob = await construirPlantilla({ marcas: ['Adidas'], categorias: ['Deportivo'], estilos: ['Running'] })
    const datos = await blob.arrayBuffer()
    const { Workbook } = await import('exceljs')
    const libro = new Workbook()
    await libro.xlsx.load(datos)
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Productos', 'Instrucciones', 'Listas'])
    const hoja = libro.getWorksheet('Productos')
    if (!hoja) throw new Error('Falta la hoja Productos')
    expect(COLUMNAS.map((_, i) => String(hoja.getRow(1).getCell(i + 1).value))).toEqual(COLUMNAS.map((c) => c.titulo))
    // Llena una fila como lo haría el admin y la lee con el lector real.
    hoja.getRow(2).getCell(1).value = 'Runner Pro'
    hoja.getRow(2).getCell(2).value = 'Caballero'
    hoja.getRow(2).getCell(7).value = 89.9
    hoja.getRow(2).getCell(11).value = '38:1, 39:2'
    const lleno = await libro.xlsx.writeBuffer()
    const filas = await leerPlantilla(lleno as ArrayBuffer)
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ fila: 2, nombre: 'Runner Pro', grupo: 'Caballero', precio_publico: '89.9', pares: '38:1, 39:2' })
  }, 30_000) // exceljs tarda en cargar cuando corre toda la suite

  it('rechaza un archivo que no es la plantilla', async () => {
    const { Workbook } = await import('exceljs')
    const libro = new Workbook()
    libro.addWorksheet('Otra').getCell(1, 1).value = 'Cliente'
    await expect(leerPlantilla((await libro.xlsx.writeBuffer()) as ArrayBuffer)).rejects.toThrow(/plantilla/i)
  })
})

describe('validación de filas', () => {
  it('acepta una fila completa y arma el rango de tallas con los pares', () => {
    const [r] = validarFilas(
      [fila(2, { nombre: 'Runner Pro', grupo: 'Caballero', marca: 'adidas', precio_publico: '89,90', precio_mayorista: '70', talla_desde: '38', talla_hasta: '40', pares: '38:1, 40=2' })],
      catalogo,
    )
    expect(r.errores).toEqual([])
    expect(r.producto).toMatchObject({ grupo: 'caballero', marca: 'Adidas', precio_publico: 89.9, precio_mayorista: 70, activo: true, destacado: false })
    expect(r.producto?.tallas).toEqual([{ etiqueta: '38', pares: 1 }, { etiqueta: '39', pares: 0 }, { etiqueta: '40', pares: 2 }])
    expect(r.nuevas).toEqual([])
  })

  it('usa el rango del grupo si no hay tallas y marca lo que se creará', () => {
    const [r] = validarFilas([fila(2, { nombre: 'Sandalia Sol', grupo: 'Dama', marca: 'Marca Nueva', precio_publico: '30' })], catalogo)
    expect(r.producto?.tallas[0].etiqueta).toBe('34')
    expect(r.producto?.tallas.at(-1)?.etiqueta).toBe('40')
    expect(r.nuevas).toEqual([{ tipo: 'marca', nombre: 'Marca Nueva' }])
  })

  it('reporta cada problema de la fila', () => {
    const [r] = validarFilas(
      [fila(5, { nombre: 'X', grupo: 'robot', precio_publico: '10', precio_mayorista: '20', talla_desde: '45', talla_hasta: '40', activo: 'tal vez' })],
      catalogo,
    )
    expect(r.producto).toBeNull()
    expect(r.errores).toEqual(
      expect.arrayContaining([
        'Falta el nombre del producto',
        'Grupo no válido: usa Dama, Caballero, Niño o Unisex',
        'El precio mayorista no puede superar el público',
        'Activo debe ser Sí o No',
      ]),
    )
  })

  it('rechaza nombres que ya existen o se repiten en el archivo', () => {
    const r = validarFilas(
      [
        fila(2, { nombre: 'foce ONE negro', grupo: 'unisex', precio_publico: '40' }),
        fila(3, { nombre: 'Nuevo', grupo: 'unisex', precio_publico: '40' }),
        fila(4, { nombre: 'nuevo', grupo: 'unisex', precio_publico: '40' }),
      ],
      catalogo,
    )
    expect(r[0].errores).toContain('Ya existe un producto con ese nombre')
    expect(r[1].errores).toEqual([])
    expect(r[2].errores).toContain('Nombre repetido (también en la fila 3)')
  })

  it('valida los pares por talla', () => {
    expect(leerPares('38:2, 39 3; 40=1').pares).toEqual({ '38': 2, '39': 3, '40': 1 })
    expect(leerPares('abc').error).toMatch(/no válidos/)
    expect(leerPares('38:500').error).toMatch(/Máximo 100/)
    const [r] = validarFilas([fila(2, { nombre: 'Modelo', grupo: 'caballero', precio_publico: '50', talla_desde: '38', talla_hasta: '40', pares: '44:2' })], catalogo)
    expect(r.errores[0]).toMatch(/fuera del rango 38 a 40/)
  })
})
