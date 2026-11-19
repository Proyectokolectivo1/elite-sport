import { z } from 'zod'

export const productoSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Ingresa el nombre del producto'),
    grupo: z.enum(['dama', 'caballero', 'nino']),
    marca_id: z.string(),
    categoria_id: z.string(),
    estilo_id: z.string(),
    descripcion: z.string().max(2000, 'Máximo 2000 caracteres'),
    precio_publico: z.number({ message: 'Ingresa el precio al público' }).min(0, 'No puede ser negativo'),
    precio_mayorista: z.number({ message: 'Precio no válido' }).min(0, 'No puede ser negativo').nullable(),
    activo: z.boolean(),
    destacado: z.boolean(),
  })
  .refine((v) => v.precio_mayorista === null || v.precio_mayorista <= v.precio_publico, {
    path: ['precio_mayorista'],
    message: 'El precio mayorista no puede superar el precio al público',
  })

export type ProductoValues = z.infer<typeof productoSchema>

export const GRUPOS: { value: ProductoValues['grupo']; label: string }[] = [
  { value: 'dama', label: 'Dama' },
  { value: 'caballero', label: 'Caballero' },
  { value: 'nino', label: 'Niño' },
]

/** Rango de tallas del modelo y surtido de la caja (pares por talla, texto del input). */
export const tallasModeloSchema = z
  .object({
    desde: z.number({ message: 'Indica la talla inicial' }).int('Usa tallas enteras').min(10, 'Mínimo 10').max(60, 'Máximo 60'),
    hasta: z.number({ message: 'Indica la talla final' }).int('Usa tallas enteras').min(10, 'Mínimo 10').max(60, 'Máximo 60'),
    pares: z.record(z.string(), z.string().refine((x) => x === '' || (/^\d+$/.test(x) && Number(x) <= 100), 'Entre 0 y 100')),
  })
  .refine((v) => v.desde <= v.hasta, { path: ['hasta'], message: 'Debe ser mayor o igual que la talla inicial' })
  .refine((v) => v.hasta - v.desde < 40, { path: ['hasta'], message: 'Máximo 40 tallas por modelo' })

export type TallasModeloValues = z.infer<typeof tallasModeloSchema>
