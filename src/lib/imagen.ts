/** Tipos de salida: WebP siempre que el navegador sepa codificarlo; si no, JPEG (ambos los acepta el almacenamiento). */
export type TipoImagen = 'image/webp' | 'image/jpeg'

export function extensionDeTipo(tipo: string): string {
  if (tipo === 'image/webp') return 'webp'
  if (tipo === 'image/png') return 'png'
  return 'jpg'
}

/** Escala que cabe en `maxLado` sin agrandar nunca la imagen. */
export function escalaPara(ancho: number, alto: number, maxLado: number): number {
  const mayor = Math.max(ancho, alto)
  return mayor <= 0 ? 1 : Math.min(1, maxLado / mayor)
}

function aBlob(canvas: HTMLCanvasElement, tipo: TipoImagen, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), tipo, calidad))
}

async function codificar(bitmap: ImageBitmap, maxLado: number, calidad: number): Promise<Blob> {
  const escala = escalaPara(bitmap.width, bitmap.height, maxLado)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * escala))
  canvas.height = Math.max(1, Math.round(bitmap.height * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  // Los navegadores sin codificador WebP devuelven PNG en silencio: se detecta y se usa JPEG.
  const webp = await aBlob(canvas, 'image/webp', calidad)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await aBlob(canvas, 'image/jpeg', calidad)
  if (!jpeg) throw new Error('No se pudo comprimir la imagen')
  return jpeg
}

/** Reduce y convierte una imagen a WebP antes de subirla. El blob trae su tipo real en `blob.type`. */
export async function comprimirImagen(archivo: File, maxLado = 1600, calidad = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo)
  try {
    return await codificar(bitmap, maxLado, calidad)
  } finally {
    bitmap.close()
  }
}

export interface ImagenOptimizada {
  /** Para la ficha del producto (lado mayor 1600 px). */
  principal: Blob
  /** Para tarjetas y listas (lado mayor 480 px): pesa una fracción de la principal. */
  miniatura: Blob
}

export async function optimizarImagen(archivo: File): Promise<ImagenOptimizada> {
  const bitmap = await createImageBitmap(archivo)
  try {
    const [principal, miniatura] = await Promise.all([codificar(bitmap, 1600, 0.82), codificar(bitmap, 480, 0.78)])
    return { principal, miniatura }
  } finally {
    bitmap.close()
  }
}
