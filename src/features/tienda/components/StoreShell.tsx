import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Toaster } from '@/components/ui/toast'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { unidadesCarrito, useCarritoStore } from '../carrito/carritoStore'
import { StoreProvider, useStore } from '../context/StoreContext'
const FondoCorredor = lazy(() => import('@/features/fondo/FondoCorredor').then((m) => ({ default: m.FondoCorredor })))
const CarritoSheet = lazy(() => import('./CarritoSheet').then((m) => ({ default: m.CarritoSheet })))

function Marco() {
  const { tienda, ruta, clave, ciudad, setCarritoAbierto, esPrincipal } = useStore()
  const navigate = useNavigate()
  const { data: config } = useConfiguracion()
  // El fondo en movimiento es solo de la tienda principal, no de las secciones de mayoristas.
  const fondoActivo = esPrincipal && !!config?.fondo_activo && !!(config.fondo_video_url || config.fondo_poster_url)
  // Marca el <html> para que las superficies de marca se vuelvan translúcidas sobre el video.
  useEffect(() => {
    if (!fondoActivo) return
    document.documentElement.dataset.fondo = 'on'
    return () => { delete document.documentElement.dataset.fondo }
  }, [fondoActivo])
  const items = useCarritoStore((s) => s.porTienda[clave])
  const { carritoAbierto } = useStore()
  // El carrito (formulario y validación) se descarga la primera vez que se abre.
  const [cargarCarrito, setCargarCarrito] = useState(false)
  if (carritoAbierto && !cargarCarrito) setCargarCarrito(true)
  return (
    <ThemeProvider brand={{ primary: tienda.color_primario, accent: tienda.color_acento }}>
      <Toaster />
      {fondoActivo && config && (
        <Suspense fallback={null}>
          <FondoCorredor video={config.fondo_video_url} videoMovil={config.fondo_video_movil_url} poster={config.fondo_poster_url} opacidad={config.fondo_opacidad} />
        </Suspense>
      )}
      <PublicLayout
        nombre={tienda.nombre}
        logoUrl={tienda.logo_url}
        basePath={ruta('/')}
        nav={[
          { to: ruta('/'), label: 'Inicio', end: true },
          { to: ruta('/catalogo'), label: 'Catálogo', end: true },
          ...(esPrincipal ? [{ to: '/registro', label: 'Ser mayorista', destacado: true }] : []),
        ]}
        cartCount={unidadesCarrito(items ?? [])}
        onCartClick={() => setCarritoAbierto(true)}
        onSearch={(q) => navigate(`${ruta('/catalogo')}${q ? `?q=${encodeURIComponent(q)}` : ''}`)}
        footer={
          <>
            <p>{ciudad}. Pedidos por WhatsApp.</p>
            {esPrincipal && (
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                <Link to="/registro" className="underline underline-offset-4 hover:opacity-100">Solicitar ser mayorista</Link>
                <Link to="/ingresar" className="underline underline-offset-4 hover:opacity-100">Ingreso de mayoristas</Link>
              </p>
            )}
          </>
        }
      />
      {cargarCarrito && <Suspense fallback={null}><CarritoSheet /></Suspense>}
    </ThemeProvider>
  )
}

/** Marco común de la tienda principal (/) y de las secciones de mayoristas (/t/:slug). */
export function StoreShell() {
  return (
    <StoreProvider>
      <Marco />
    </StoreProvider>
  )
}
