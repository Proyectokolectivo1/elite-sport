import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useMiTienda } from '../hooks/useMayorista'

export function CompartirPage() {
  const { data: tienda, isLoading } = useMiTienda()
  const [qr, setQr] = useState<string | null>(null)
  const enlace = tienda ? `${window.location.origin}/t/${tienda.slug}` : ''

  useEffect(() => {
    if (!enlace) return
    let activo = true
    QRCode.toDataURL(enlace, { width: 480, margin: 2, color: { dark: '#0b0b0c', light: '#ffffff' } })
      .then((u) => activo && setQr(u))
      .catch(() => activo && setQr(null))
    return () => { activo = false }
  }, [enlace])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar. Selecciónalo y cópialo a mano.')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!tienda) return null
  return (
    <>
      <PageHeader title="Compartir" description="Envía este enlace por WhatsApp o redes, o imprime el código QR para tu local." />
      <div className="grid max-w-3xl gap-8 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <p className="eyebrow">Enlace de tu sección</p>
          <p className="break-all rounded-md border border-border bg-card p-4 font-mono text-sm">{enlace}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copiar()}><Copy /> Copiar enlace</Button>
            <a href={enlace} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-md border border-foreground/30 px-5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] hover:border-foreground"><ExternalLink className="size-4" /> Abrir</a>
          </div>
          {!tienda.activa && <p className="text-sm text-warning">Tu sección está desactivada. Comunícate con Elite Sport.</p>}
        </div>
        <div>
          {qr ? <img src={qr} alt={`Código QR de ${enlace}`} className="w-full rounded-md border border-border" /> : <Skeleton className="aspect-square w-full" />}
          {qr && <a href={qr} download={`qr-${tienda.slug}.png`} className="mt-2 block text-center text-sm underline underline-offset-4">Descargar QR</a>}
        </div>
      </div>
    </>
  )
}
