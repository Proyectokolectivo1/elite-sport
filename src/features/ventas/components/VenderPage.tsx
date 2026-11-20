import { PageHeader } from '@/components/ui/page-header'
import { MisEntregas } from '@/features/bodega/components/MisEntregas'
import { PedirABodega } from '@/features/bodega/components/PedirABodega'

/** Pantalla del vendedor de un local: pide pares a bodega con su precio de venta. La venta se asienta cuando bodega la cierra. */
export function VenderPage() {
  return (
    <>
      <PageHeader
        title="Vender"
        description="Elige los pares del catálogo habilitado y pon tu precio de venta; la referencia es el precio de la página. Bodega te los entrega y, al cerrar, asienta la venta a tu local y a ti."
      />
      <PedirABodega conPrecio />
      <h2 className="mt-10 mb-4 text-3xl">Mis pedidos</h2>
      <MisEntregas vacio="Aún no has pedido pares a bodega." />
    </>
  )
}
