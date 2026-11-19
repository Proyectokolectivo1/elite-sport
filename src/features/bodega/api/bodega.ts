import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'
import type { MetodoPago, VentaEntrada } from '@/features/ventas/api/ventas'
import {
  listaBodegaSchema,
  paresEnPoderSchema,
  resultadoCierreSchema,
  resultadoSolicitudSchema,
  resultadoVentaSchema,
  type IntegranteValues,
  type NuevoUsuarioValues,
} from '../schemas'
import type { z } from 'zod'

export type VistaBodega = 'por_despachar' | 'en_poder' | 'web' | 'historial'
export type PedidoBodega = z.infer<typeof listaBodegaSchema>[number]
export type ParEnPoder = z.infer<typeof paresEnPoderSchema>[number]

/** Fotos (miniatura de 480 px) por producto y color, para reconocer el par de un vistazo. */
export async function fotosPorColor(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('imagenes_producto').select('producto_id, color, url, url_miniatura, orden').order('orden')
  if (error) throw error
  const m: Record<string, string> = {}
  for (const i of data) {
    const src = i.url_miniatura ?? i.url
    m[`${i.producto_id}|${i.color}`] ??= src
    m[`${i.producto_id}|`] ??= src
  }
  return m
}

export const claveFoto = (productoId: string, color: string) => `${productoId}|${color}`

// ============ Bodeguero (sin precios) ============
export async function listarPedidosBodega(vista: VistaBodega): Promise<PedidoBodega[]> {
  const { data, error } = await supabase.rpc('listar_pedidos_bodega', { p_vista: vista })
  if (error) throw error
  return listaBodegaSchema.parse(data)
}

export async function despacharPedido(pedidoId: string, lineas: { detalleId: string; entregados: number }[]): Promise<void> {
  const { error } = await supabase.rpc('despachar_pedido_bodega', {
    p_pedido: pedidoId,
    p_lineas: lineas.map((l) => ({ detalle_id: l.detalleId, entregados: l.entregados })),
  })
  if (error) throw error
}

export async function recibirDevolucion(pedidoId: string, lineas: { detalleId: string; devueltos: number }[]): Promise<void> {
  const { error } = await supabase.rpc('devolver_a_bodega', {
    p_pedido: pedidoId,
    p_lineas: lineas.map((l) => ({ detalle_id: l.detalleId, devueltos: l.devueltos })),
  })
  if (error) throw error
}

export async function cerrarEntrega(
  pedidoId: string,
  lineas: { detalleId: string; vendidos: number; devueltos: number }[],
): Promise<{ ventaSinRegistrar: number | null }> {
  const { data, error } = await supabase.rpc('cerrar_pedido_bodega', {
    p_pedido: pedidoId,
    p_lineas: lineas.map((l) => ({ detalle_id: l.detalleId, vendidos: l.vendidos, devueltos: l.devueltos })),
  })
  if (error) throw error
  return { ventaSinRegistrar: resultadoCierreSchema.parse(data).venta_sin_registrar }
}

export async function entregarPedidoWeb(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('entregar_pedido', { p_pedido: pedidoId })
  if (error) throw error
}

export async function cancelarPedidoBodega(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: pedidoId })
  if (error) throw error
}

// ============ Vendedor y mayorista del sector ============
export async function solicitarABodega(items: { varianteId: string; cantidad: number }[], nota: string): Promise<{ numero: number }> {
  const { data, error } = await supabase.rpc('solicitar_a_bodega', {
    p_items: items.map((i) => ({ variante_id: i.varianteId, cantidad: i.cantidad })),
    p_nota: nota.trim() || undefined,
  })
  if (error) throw error
  return { numero: resultadoSolicitudSchema.parse(data).numero }
}

export async function misParesEnPoder(): Promise<ParEnPoder[]> {
  const { data, error } = await supabase.rpc('mis_pares_en_poder')
  if (error) throw error
  return paresEnPoderSchema.parse(data)
}

export interface LineaMiEntrega {
  id: string
  descripcion: string
  cantidad: number
  entregada: number | null
  vendida: number | null
  devuelta: number | null
  precio: number
}

export interface MiEntrega {
  id: string
  numero: number
  estado: Enums<'estado_pedido'>
  total: number
  nota: string | null
  creadoEn: string
  despachadoEn: string | null
  liquidadoEn: string | null
  pagadoEn: string | null
  lineas: LineaMiEntrega[]
}

/** Pedidos a bodega del usuario (la RLS ya limita a los suyos). */
export async function misEntregas(usuarioId: string): Promise<MiEntrega[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, estado, total, nota, creado_en, despachado_en, liquidado_en, pagado_en, pedidos_detalle!pedidos_detalle_pedido_id_fkey(id, descripcion, cantidad, cantidad_entregada, cantidad_vendida, cantidad_devuelta, precio_unitario)')
    .eq('tipo', 'consignacion')
    .eq('solicitante_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(60)
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    total: p.total,
    nota: p.nota,
    creadoEn: p.creado_en,
    despachadoEn: p.despachado_en,
    liquidadoEn: p.liquidado_en,
    pagadoEn: p.pagado_en,
    lineas: p.pedidos_detalle.map((d) => ({
      id: d.id,
      descripcion: d.descripcion,
      cantidad: d.cantidad,
      entregada: d.cantidad_entregada,
      vendida: d.cantidad_vendida,
      devuelta: d.cantidad_devuelta,
      precio: d.precio_unitario,
    })),
  }))
}

export interface MiVenta {
  id: string
  numero: number
  estado: Enums<'estado_pedido'>
  cliente: string
  metodoPago: MetodoPago | null
  total: number
  nota: string | null
  creadoEn: string
}

/** Ventas del local registradas por el vendedor desde una fecha. */
export async function misVentasLocal(usuarioId: string, desde: Date): Promise<MiVenta[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, estado, cliente_nombre, metodo_pago, total, nota, creado_en')
    .eq('tipo', 'mostrador')
    .eq('solicitante_id', usuarioId)
    .gte('creado_en', desde.toISOString())
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    estado: p.estado,
    cliente: p.cliente_nombre,
    metodoPago: p.metodo_pago,
    total: p.total,
    nota: p.nota,
    creadoEn: p.creado_en,
  }))
}

/** Venta del local con pares que el vendedor tiene en su poder. No toca el stock central. */
export async function registrarVentaLocal(v: VentaEntrada): Promise<{ numero: number; total: number }> {
  const { data, error } = await supabase.rpc('registrar_venta_local', {
    p_items: v.items,
    p_metodo_pago: v.metodoPago,
    p_cliente_nombre: v.nombre || undefined,
    p_cliente_telefono: v.telefono || undefined,
    p_cliente_correo: v.correo || undefined,
    p_cliente_documento: v.documento || undefined,
    p_nota: v.nota || undefined,
  })
  if (error) throw error
  const r = resultadoVentaSchema.parse(data)
  return { numero: r.numero, total: r.total }
}

// ============ Equipo (admin) ============
export interface Integrante {
  id: string
  nombre: string
  negocio: string | null
  correo: string | null
  telefono: string | null
  rol: Enums<'rol_usuario'>
  estado: Enums<'estado_perfil'>
  creadoEn: string
}

export async function listarEquipo(): Promise<Integrante[]> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, negocio, correo, telefono, rol, estado, creado_en')
    .neq('rol', 'admin')
    .order('creado_en', { ascending: false })
    .limit(500)
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    negocio: p.negocio,
    correo: p.correo,
    telefono: p.telefono,
    rol: p.rol,
    estado: p.estado,
    creadoEn: p.creado_en,
  }))
}

export async function actualizarIntegrante(id: string, v: IntegranteValues): Promise<void> {
  const { error } = await supabase.from('perfiles').update({ rol: v.rol, estado: v.estado }).eq('id', id)
  if (error) throw error
}

// ============ Cobros a mayoristas del sector ============
export interface CierreCobro {
  id: string
  numero: number
  total: number
  liquidadoEn: string | null
  pagadoEn: string | null
}

export interface CuentaSector {
  id: string
  nombre: string
  negocio: string | null
  /** Cierres sin pagar: lo que debe ahora. */
  porCobrar: number
  /** Lo ya pagado. */
  pagado: number
  /** Pares que aún tiene en su poder, a su precio: lo máximo que podría deber si los vende todos. */
  enPoderValor: number
  enPoderPares: number
  cierres: CierreCobro[]
}

/** Cuenta de cada mayorista del sector (solo admin: la RLS no deja leer esto a otros). */
export async function cuentasSector(): Promise<CuentaSector[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, estado, total, liquidado_en, pagado_en, solicitante_id, perfiles!pedidos_solicitante_id_fkey(nombre, negocio, rol), pedidos_detalle!pedidos_detalle_pedido_id_fkey(cantidad_entregada, cantidad_vendida, cantidad_devuelta, precio_unitario)')
    .eq('tipo', 'consignacion')
    .in('estado', ['entregado', 'liquidado'])
    .order('liquidado_en', { ascending: false, nullsFirst: true })
    .limit(500)
  if (error) throw error
  const m = new Map<string, CuentaSector>()
  for (const p of data) {
    if (!p.solicitante_id || p.perfiles?.rol !== 'mayorista_sector') continue
    const c = m.get(p.solicitante_id) ?? { id: p.solicitante_id, nombre: p.perfiles.nombre, negocio: p.perfiles.negocio, porCobrar: 0, pagado: 0, enPoderValor: 0, enPoderPares: 0, cierres: [] }
    if (p.estado === 'liquidado') {
      if (p.pagado_en) c.pagado += p.total
      else c.porCobrar += p.total
      if (p.total > 0) c.cierres.push({ id: p.id, numero: p.numero, total: p.total, liquidadoEn: p.liquidado_en, pagadoEn: p.pagado_en })
    } else {
      for (const d of p.pedidos_detalle) {
        const n = (d.cantidad_entregada ?? 0) - (d.cantidad_vendida ?? 0) - (d.cantidad_devuelta ?? 0)
        c.enPoderPares += n
        c.enPoderValor += n * d.precio_unitario
      }
    }
    m.set(p.solicitante_id, c)
  }
  return [...m.values()].sort((a, b) => b.porCobrar - a.porCobrar || (a.negocio ?? a.nombre).localeCompare(b.negocio ?? b.nombre, 'es'))
}

export async function marcarPagoCierre(pedidoId: string, pagado: boolean): Promise<void> {
  const { error } = await supabase.rpc('marcar_pago_consignacion', { p_pedido: pedidoId, p_pagado: pagado })
  if (error) throw error
}

// ============ Altas y claves (funcion segura del servidor, solo admin) ============
async function invocarGestion(cuerpo: Record<string, unknown>): Promise<{ id?: string }> {
  const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: cuerpo })
  if (error) {
    // La funcion responde { error: "mensaje" } con el motivo; se muestra tal cual.
    const ctx = (error as { context?: unknown }).context
    if (ctx instanceof Response) {
      const j = (await ctx.json().catch(() => null)) as { error?: string } | null
      if (j?.error) throw new Error(j.error)
    }
    throw new Error('No se pudo completar la acción. Intenta de nuevo.')
  }
  return data as { id?: string }
}

export const crearUsuario = (v: NuevoUsuarioValues) => invocarGestion({ accion: 'crear', ...v, estado: 'aprobado' })
export const cambiarContrasenaUsuario = (id: string, contrasena: string) => invocarGestion({ accion: 'contrasena', id, contrasena })
