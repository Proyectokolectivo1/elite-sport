import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { Toaster } from '@/components/ui/toast'
import { unidadesCarrito, useCarritoStore } from '../carrito/carritoStore'
import { StoreProvider, useStore } from '../context/StoreContext'
const CarritoSheet = lazy(() => import('./CarritoSheet').then((m) => ({ default: m.CarritoSheet })))

function Marco() {
  const { tienda, ruta, clave, ciudad, setCarritoAbierto, esPrincipal } = useStore()
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
          ...(esPrincipal ? [{ to: '/registro', label: 'Ser mayorista', destacado: true }] : []),
        ]}
        menu={[
          {
            titulo: 'Comprar',
            items: [
              { to: ruta('/'), label: 'Inicio' },
              { to: ruta('/catalogo'), label: 'Todo el catálogo' },
              { to: ruta('/catalogo?g=dama'), label: 'Dama' },
              { to: ruta('/catalogo?g=caballero'), label: 'Caballero' },
              { to: ruta('/catalogo?g=nino'), label: 'Niño' },
            ],
          },
          ...(esPrincipal
            ? [
                {
                  titulo: 'Mayoristas',
                  items: [
                    { to: '/registro', label: 'Solicitar ser mayorista', detalle: 'Compra a precio mayorista y arma tu propia sección de venta.' },
                  ],
                },
                {
                  titulo: 'Acceso',
                  items: [{ to: '/ingresar', label: 'Ingresar', detalle: 'Mayoristas, equipo y administración entran aquí con su correo y llegan a su panel.' }],
                },
              ]
            : []),
        ]}
        cartCount={unidadesCarrito(items ?? [])}
        onCartClick={() => setCarritoAbierto(true)}
        onSearch={(q) => navigate(`${ruta('/catalogo')}${q ? `?q=${encodeURIComponent(q)}` : ''}`)}
        footer={
          <>
            <p>{ciudad}. Pedidos por WhatsApp.</p>
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
