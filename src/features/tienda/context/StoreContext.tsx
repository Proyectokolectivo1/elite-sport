import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { obtenerCatalogoPublico, obtenerPreciosTienda, obtenerTienda, type ProductoPublico, type Tienda } from '../api/tienda'

interface StoreValue {
  tienda: Tienda
  esPrincipal: boolean
  /** Clave del carrito: "principal" o el slug del mayorista. */
  clave: string
  /** Construye rutas dentro de la tienda: ruta('/catalogo') -> "/catalogo" o "/t/slug/catalogo". */
  ruta: (path: string) => string
  /** Número de WhatsApp que recibe los pedidos. */
  whatsapp: string | null
  ciudad: string
  productos: ProductoPublico[]
  /** true mientras llega el catálogo (para mostrar esqueletos y no saltar el diseño). */
  cargando: boolean
  /** Precio de la tienda activa: el del mayorista si lo fijó, si no el PVP. */
  precio: (p: ProductoPublico) => number
  carritoAbierto: boolean
  setCarritoAbierto: (abierto: boolean) => void
}

const StoreContext = createContext<StoreValue | null>(null)

/** Marca por defecto de la tienda principal: se pinta al instante mientras llegan los datos reales. */
const PRINCIPAL_INICIAL: Tienda = {
  id: '',
  propietario_id: null,
  slug: 'elite-sport',
  nombre: 'Elite Sport',
  logo_url: null,
  banner_url: null,
  color_primario: '#0b0b0c',
  color_acento: '#c8ff2e',
  whatsapp: null,
  plantilla_mensaje: 'Hola Elite Sport, quiero hacer este pedido:',
  activa: true,
  es_principal: true,
  creado_en: '',
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams()
  const { data: config } = useConfiguracion()
  const [carritoAbierto, setCarritoAbierto] = useState(false)

  const tiendaQ = useQuery({ queryKey: ['tienda', slug ?? 'principal'], queryFn: () => obtenerTienda(slug ?? null), staleTime: 60_000 })
  // En la tienda principal no se espera a la red para mostrar la portada.
  const tienda = tiendaQ.data ?? (slug ? undefined : tiendaQ.isLoading ? PRINCIPAL_INICIAL : undefined)
  const preciosQ = useQuery({
    queryKey: ['precios-tienda', tienda?.id],
    queryFn: () => obtenerPreciosTienda(tienda?.id as string),
    enabled: !!tienda && !tienda.es_principal,
    staleTime: 60_000,
  })
  const catalogoQ = useQuery({ queryKey: ['catalogo-publico'], queryFn: obtenerCatalogoPublico, staleTime: 60_000 })

  const base = slug ? `/t/${slug}` : ''
  const ruta = useCallback((path: string) => `${base}${path}` || '/', [base])

  const value = useMemo<StoreValue | null>(() => {
    if (!tienda) return null
    const propios = preciosQ.data ?? {}
    return {
      tienda,
      esPrincipal: tienda.es_principal,
      clave: tienda.es_principal ? 'principal' : tienda.slug,
      ruta,
      whatsapp: tienda.es_principal ? (tienda.whatsapp ?? config?.whatsapp_principal ?? null) : tienda.whatsapp,
      ciudad: config?.ciudad ?? 'Guayaquil',
      productos: catalogoQ.data ?? [],
      cargando: catalogoQ.isLoading,
      precio: (p) => propios[p.id] ?? p.pvp,
      carritoAbierto,
      setCarritoAbierto,
    }
  }, [tienda, preciosQ.data, catalogoQ.data, catalogoQ.isLoading, config, ruta, carritoAbierto])

  if (tiendaQ.isLoading && !tienda) {
    return (
      <div className="container-page space-y-4 py-16">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }
  if (!value) {
    return (
      <main className="grid min-h-dvh place-items-center px-[var(--gutter)]">
        <div className="max-w-md space-y-3">
          <p className="eyebrow">Error 404</p>
          <h1 className="text-5xl">Esta tienda no está disponible</h1>
          <p className="text-muted-foreground">El enlace puede estar mal escrito o la tienda estar desactivada.</p>
        </div>
      </main>
    )
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return ctx
}
