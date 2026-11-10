// Tipos del esquema de Supabase (proyecto bjvwzqbvufckzlesnxzm).
// Regenerar con `npm run db:types` cuando cambie el esquema.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Enum<K extends keyof Database['public']['Enums']> = Database['public']['Enums'][K]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      categorias: {
        Row: { id: string; nombre: string; slug: string }
        Insert: { id?: string; nombre: string; slug: string }
        Update: { id?: string; nombre?: string; slug?: string }
        Relationships: []
      }
      estilos: {
        Row: { id: string; nombre: string; slug: string }
        Insert: { id?: string; nombre: string; slug: string }
        Update: { id?: string; nombre?: string; slug?: string }
        Relationships: []
      }
      marcas: {
        Row: { id: string; nombre: string; slug: string }
        Insert: { id?: string; nombre: string; slug: string }
        Update: { id?: string; nombre?: string; slug?: string }
        Relationships: []
      }
      configuracion: {
        Row: {
          actualizado_en: string; ciudad: string; id: number; locale: string; moneda_codigo: string
          moneda_decimales: number; moneda_simbolo: string; nombre_negocio: string; whatsapp_principal: string | null
        }
        Insert: {
          actualizado_en?: string; ciudad?: string; id?: number; locale?: string; moneda_codigo?: string
          moneda_decimales?: number; moneda_simbolo?: string; nombre_negocio?: string; whatsapp_principal?: string | null
        }
        Update: {
          actualizado_en?: string; ciudad?: string; id?: number; locale?: string; moneda_codigo?: string
          moneda_decimales?: number; moneda_simbolo?: string; nombre_negocio?: string; whatsapp_principal?: string | null
        }
        Relationships: []
      }
      curvas_tallas: {
        Row: { grupo: Enum<'grupo_talla'>; id: string; nombre: string }
        Insert: { grupo: Enum<'grupo_talla'>; id?: string; nombre: string }
        Update: { grupo?: Enum<'grupo_talla'>; id?: string; nombre?: string }
        Relationships: []
      }
      curvas_tallas_detalle: {
        Row: { curva_id: string; pares: number; talla_id: string }
        Insert: { curva_id: string; pares: number; talla_id: string }
        Update: { curva_id?: string; pares?: number; talla_id?: string }
        Relationships: [
          { foreignKeyName: 'curvas_tallas_detalle_curva_id_fkey'; columns: ['curva_id']; isOneToOne: false; referencedRelation: 'curvas_tallas'; referencedColumns: ['id'] },
          { foreignKeyName: 'curvas_tallas_detalle_talla_id_fkey'; columns: ['talla_id']; isOneToOne: false; referencedRelation: 'tallas'; referencedColumns: ['id'] },
        ]
      }
      imagenes_producto: {
        Row: { color: string; id: string; orden: number; producto_id: string; url: string }
        Insert: { color: string; id?: string; orden?: number; producto_id: string; url: string }
        Update: { color?: string; id?: string; orden?: number; producto_id?: string; url?: string }
        Relationships: [
          { foreignKeyName: 'imagenes_producto_producto_id_fkey'; columns: ['producto_id']; isOneToOne: false; referencedRelation: 'productos'; referencedColumns: ['id'] },
        ]
      }
      ingresos_inventario: {
        Row: {
          creado_en: string; creado_por: string | null; id: string; nota: string | null
          num_cajas: number; proveedor: string | null; referencia: string | null; tipo: Enum<'tipo_ingreso'>
        }
        Insert: {
          creado_en?: string; creado_por?: string | null; id?: string; nota?: string | null
          num_cajas?: number; proveedor?: string | null; referencia?: string | null; tipo: Enum<'tipo_ingreso'>
        }
        Update: {
          creado_en?: string; creado_por?: string | null; id?: string; nota?: string | null
          num_cajas?: number; proveedor?: string | null; referencia?: string | null; tipo?: Enum<'tipo_ingreso'>
        }
        Relationships: [
          { foreignKeyName: 'ingresos_inventario_creado_por_fkey'; columns: ['creado_por']; isOneToOne: false; referencedRelation: 'perfiles'; referencedColumns: ['id'] },
        ]
      }
      ingresos_inventario_detalle: {
        Row: { cantidad: number; id: string; ingreso_id: string; pares_por_caja: number | null; variante_id: string }
        Insert: { cantidad: number; id?: string; ingreso_id: string; pares_por_caja?: number | null; variante_id: string }
        Update: { cantidad?: number; id?: string; ingreso_id?: string; pares_por_caja?: number | null; variante_id?: string }
        Relationships: [
          { foreignKeyName: 'ingresos_inventario_detalle_ingreso_id_fkey'; columns: ['ingreso_id']; isOneToOne: false; referencedRelation: 'ingresos_inventario'; referencedColumns: ['id'] },
          { foreignKeyName: 'ingresos_inventario_detalle_variante_id_fkey'; columns: ['variante_id']; isOneToOne: false; referencedRelation: 'variantes_producto'; referencedColumns: ['id'] },
        ]
      }
      movimientos_inventario: {
        Row: {
          creado_en: string; creado_por: string | null; delta: number; id: string
          motivo: Enum<'motivo_movimiento'>; nota: string | null; referencia_id: string | null; variante_id: string
        }
        Insert: {
          creado_en?: string; creado_por?: string | null; delta: number; id?: string
          motivo: Enum<'motivo_movimiento'>; nota?: string | null; referencia_id?: string | null; variante_id: string
        }
        Update: {
          creado_en?: string; creado_por?: string | null; delta?: number; id?: string
          motivo?: Enum<'motivo_movimiento'>; nota?: string | null; referencia_id?: string | null; variante_id?: string
        }
        Relationships: [
          { foreignKeyName: 'movimientos_inventario_creado_por_fkey'; columns: ['creado_por']; isOneToOne: false; referencedRelation: 'perfiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'movimientos_inventario_variante_id_fkey'; columns: ['variante_id']; isOneToOne: false; referencedRelation: 'variantes_producto'; referencedColumns: ['id'] },
        ]
      }
      pedidos: {
        Row: {
          cliente_nombre: string; cliente_telefono: string; creado_en: string; estado: Enum<'estado_pedido'>
          id: string; mayorista_id: string | null; moneda: string; nota: string | null; numero: number
          stock_descontado: boolean; tienda_id: string | null; tipo: Enum<'tipo_pedido'>; total: number
        }
        Insert: {
          cliente_nombre: string; cliente_telefono: string; creado_en?: string; estado?: Enum<'estado_pedido'>
          id?: string; mayorista_id?: string | null; moneda: string; nota?: string | null; numero?: never
          stock_descontado?: boolean; tienda_id?: string | null; tipo: Enum<'tipo_pedido'>; total?: number
        }
        Update: {
          cliente_nombre?: string; cliente_telefono?: string; creado_en?: string; estado?: Enum<'estado_pedido'>
          id?: string; mayorista_id?: string | null; moneda?: string; nota?: string | null; numero?: never
          stock_descontado?: boolean; tienda_id?: string | null; tipo?: Enum<'tipo_pedido'>; total?: number
        }
        Relationships: [
          { foreignKeyName: 'pedidos_mayorista_id_fkey'; columns: ['mayorista_id']; isOneToOne: false; referencedRelation: 'perfiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'pedidos_tienda_id_fkey'; columns: ['tienda_id']; isOneToOne: false; referencedRelation: 'tiendas'; referencedColumns: ['id'] },
        ]
      }
      pedidos_detalle: {
        Row: { cantidad: number; descripcion: string; id: string; pedido_id: string; precio_unitario: number; variante_id: string }
        Insert: { cantidad: number; descripcion: string; id?: string; pedido_id: string; precio_unitario: number; variante_id: string }
        Update: { cantidad?: number; descripcion?: string; id?: string; pedido_id?: string; precio_unitario?: number; variante_id?: string }
        Relationships: [
          { foreignKeyName: 'pedidos_detalle_pedido_id_fkey'; columns: ['pedido_id']; isOneToOne: false; referencedRelation: 'pedidos'; referencedColumns: ['id'] },
          { foreignKeyName: 'pedidos_detalle_variante_id_fkey'; columns: ['variante_id']; isOneToOne: false; referencedRelation: 'variantes_producto'; referencedColumns: ['id'] },
        ]
      }
      perfiles: {
        Row: {
          cedula_ruc: string | null; ciudad: string | null; creado_en: string; estado: Enum<'estado_perfil'>
          id: string; negocio: string | null; nombre: string; rol: Enum<'rol_usuario'>; telefono: string | null
        }
        Insert: {
          cedula_ruc?: string | null; ciudad?: string | null; creado_en?: string; estado?: Enum<'estado_perfil'>
          id: string; negocio?: string | null; nombre?: string; rol?: Enum<'rol_usuario'>; telefono?: string | null
        }
        Update: {
          cedula_ruc?: string | null; ciudad?: string | null; creado_en?: string; estado?: Enum<'estado_perfil'>
          id?: string; negocio?: string | null; nombre?: string; rol?: Enum<'rol_usuario'>; telefono?: string | null
        }
        Relationships: []
      }
      precios_especiales_mayorista: {
        Row: { descuento_pct: number | null; id: string; mayorista_id: string; precio: number | null; producto_id: string }
        Insert: { descuento_pct?: number | null; id?: string; mayorista_id: string; precio?: number | null; producto_id: string }
        Update: { descuento_pct?: number | null; id?: string; mayorista_id?: string; precio?: number | null; producto_id?: string }
        Relationships: [
          { foreignKeyName: 'precios_especiales_mayorista_mayorista_id_fkey'; columns: ['mayorista_id']; isOneToOne: false; referencedRelation: 'perfiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'precios_especiales_mayorista_producto_id_fkey'; columns: ['producto_id']; isOneToOne: false; referencedRelation: 'productos'; referencedColumns: ['id'] },
        ]
      }
      precios_mayorista: {
        Row: { precio: number; producto_id: string }
        Insert: { precio: number; producto_id: string }
        Update: { precio?: number; producto_id?: string }
        Relationships: [
          { foreignKeyName: 'precios_mayorista_producto_id_fkey'; columns: ['producto_id']; isOneToOne: true; referencedRelation: 'productos'; referencedColumns: ['id'] },
        ]
      }
      precios_tienda: {
        Row: { precio: number; producto_id: string; tienda_id: string }
        Insert: { precio: number; producto_id: string; tienda_id: string }
        Update: { precio?: number; producto_id?: string; tienda_id?: string }
        Relationships: [
          { foreignKeyName: 'precios_tienda_producto_id_fkey'; columns: ['producto_id']; isOneToOne: false; referencedRelation: 'productos'; referencedColumns: ['id'] },
          { foreignKeyName: 'precios_tienda_tienda_id_fkey'; columns: ['tienda_id']; isOneToOne: false; referencedRelation: 'tiendas'; referencedColumns: ['id'] },
        ]
      }
      productos: {
        Row: {
          activo: boolean; categoria_id: string | null; creado_en: string; descripcion: string | null; destacado: boolean
          estilo_id: string | null; grupo: Enum<'grupo_talla'>; id: string; marca_id: string | null
          nombre: string; precio_publico: number; slug: string
        }
        Insert: {
          activo?: boolean; categoria_id?: string | null; creado_en?: string; descripcion?: string | null; destacado?: boolean
          estilo_id?: string | null; grupo: Enum<'grupo_talla'>; id?: string; marca_id?: string | null
          nombre: string; precio_publico: number; slug: string
        }
        Update: {
          activo?: boolean; categoria_id?: string | null; creado_en?: string; descripcion?: string | null; destacado?: boolean
          estilo_id?: string | null; grupo?: Enum<'grupo_talla'>; id?: string; marca_id?: string | null
          nombre?: string; precio_publico?: number; slug?: string
        }
        Relationships: [
          { foreignKeyName: 'productos_categoria_id_fkey'; columns: ['categoria_id']; isOneToOne: false; referencedRelation: 'categorias'; referencedColumns: ['id'] },
          { foreignKeyName: 'productos_estilo_id_fkey'; columns: ['estilo_id']; isOneToOne: false; referencedRelation: 'estilos'; referencedColumns: ['id'] },
          { foreignKeyName: 'productos_marca_id_fkey'; columns: ['marca_id']; isOneToOne: false; referencedRelation: 'marcas'; referencedColumns: ['id'] },
        ]
      }
      tallas: {
        Row: { etiqueta: string; grupo: Enum<'grupo_talla'>; id: string; orden: number }
        Insert: { etiqueta: string; grupo: Enum<'grupo_talla'>; id?: string; orden: number }
        Update: { etiqueta?: string; grupo?: Enum<'grupo_talla'>; id?: string; orden?: number }
        Relationships: []
      }
      tiendas: {
        Row: {
          activa: boolean; banner_url: string | null; color_acento: string; color_primario: string; creado_en: string
          es_principal: boolean; id: string; logo_url: string | null; nombre: string; plantilla_mensaje: string
          propietario_id: string | null; slug: string; whatsapp: string | null
        }
        Insert: {
          activa?: boolean; banner_url?: string | null; color_acento?: string; color_primario?: string; creado_en?: string
          es_principal?: boolean; id?: string; logo_url?: string | null; nombre: string; plantilla_mensaje?: string
          propietario_id?: string | null; slug: string; whatsapp?: string | null
        }
        Update: {
          activa?: boolean; banner_url?: string | null; color_acento?: string; color_primario?: string; creado_en?: string
          es_principal?: boolean; id?: string; logo_url?: string | null; nombre?: string; plantilla_mensaje?: string
          propietario_id?: string | null; slug?: string; whatsapp?: string | null
        }
        Relationships: [
          { foreignKeyName: 'tiendas_propietario_id_fkey'; columns: ['propietario_id']; isOneToOne: true; referencedRelation: 'perfiles'; referencedColumns: ['id'] },
        ]
      }
      variantes_producto: {
        Row: { color: string; id: string; producto_id: string; sku: string; stock: number; talla_id: string }
        Insert: { color: string; id?: string; producto_id: string; sku: string; stock?: number; talla_id: string }
        Update: { color?: string; id?: string; producto_id?: string; sku?: string; stock?: number; talla_id?: string }
        Relationships: [
          { foreignKeyName: 'variantes_producto_producto_id_fkey'; columns: ['producto_id']; isOneToOne: false; referencedRelation: 'productos'; referencedColumns: ['id'] },
          { foreignKeyName: 'variantes_producto_talla_id_fkey'; columns: ['talla_id']; isOneToOne: false; referencedRelation: 'tallas'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      ajustar_stock: { Args: { p_delta: number; p_nota: string; p_variante: string }; Returns: undefined }
      cancelar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      confirmar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      crear_pedido: {
        Args: {
          p_cliente_nombre: string; p_cliente_telefono: string; p_items: Json
          p_nota?: string; p_tienda_id?: string; p_tipo: Enum<'tipo_pedido'>
        }
        Returns: Json
      }
      entregar_pedido: { Args: { p_pedido: string }; Returns: undefined }
      es_admin: { Args: never; Returns: boolean }
      es_mayorista_aprobado: { Args: never; Returns: boolean }
      obtener_precio_mayorista: { Args: { p_mayorista?: string; p_producto: string }; Returns: number }
      registrar_ingreso_inventario: {
        Args: {
          p_color?: string; p_lineas: Json; p_nota?: string; p_num_cajas: number; p_producto_id: string
          p_proveedor?: string; p_referencia?: string; p_tipo: Enum<'tipo_ingreso'>
        }
        Returns: string
      }
    }
    Enums: {
      estado_pedido: 'nuevo' | 'confirmado' | 'entregado' | 'cancelado'
      estado_perfil: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido'
      grupo_talla: 'dama' | 'caballero' | 'nino'
      motivo_movimiento: 'ingreso' | 'venta' | 'pedido_mayorista' | 'ajuste' | 'anulacion'
      rol_usuario: 'admin' | 'mayorista'
      tipo_ingreso: 'caja' | 'unidad'
      tipo_pedido: 'minorista' | 'mayorista' | 'lead_tienda'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type Tables_ = Database['public']['Tables']
export type Tables<T extends keyof Tables_> = Tables_[T]['Row']
export type TablesInsert<T extends keyof Tables_> = Tables_[T]['Insert']
export type TablesUpdate<T extends keyof Tables_> = Tables_[T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
