import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Toaster } from '@/components/ui/toast'
import { unidadesCarrito, useCarritoStore } from '../carrito/carritoStore'
import { StoreProvider, useStore } from '../context/StoreContext'
const CarritoSheet = lazy(() => import('./CarritoSheet').then((m) => ({ default: m.CarritoSheet })))

function Marco() {
  const { tienda, ruta, clave, ciudad, setCarritoAbierto } = useStore()
  const navigate = useNavigate()
  const items = useCarritoStore((s) => s.porTienda[clave])
  const { carritoAbierto } = useStore()
  // El carrito (formulario y validación) se descarga la primera vez que se abre.
  const [cargarCarrito, setCargarCarrito] = useState(false)
  if (carritoAbierto && !cargarCarrito) setCargarCarrito(true)
  return (
    <ThemeProvider brand={{ primary: tienda.color_primario, accent: tienda.color_acento }}>
      <Toaster />
      <PublicLayout
        nombre={tienda.nombre}
        logoUrl={tienda.logo_url}
        basePath={ruta('/')}
        nav={[
          { to: ruta('/'), label: 'Inicio', end: true },
          { to: ruta('/catalogo'), label: 'Catálogo', end: true },
        ]}
        cartCount={unidadesCarrito(items ?? [])}
        onCartClick={() => setCarritoAbierto(true)}
        onSearch={(q) => navigate(`${ruta('/catalogo')}${q ? `?q=${encodeURIComponent(q)}` : ''}`)}
        footer={`${ciudad}. Pedidos por WhatsApp.`}
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
