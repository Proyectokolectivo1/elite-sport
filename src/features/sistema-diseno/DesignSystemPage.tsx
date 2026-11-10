import { useState } from 'react'
import { Heart, LayoutGrid, Package, Settings, Users } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PanelLayout } from '@/components/layout/PanelLayout'
import { ThemeProvider, useTheme } from '@/components/theme/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input'
import { Price } from '@/components/ui/price'
import { ProductCard } from '@/components/ui/product-card'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { SizeSelector, type TallaOpcion } from '@/components/ui/size-selector'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast, Toaster } from '@/components/ui/toast'
import { contrastRatio } from '@/lib/color'

const TALLAS: TallaOpcion[] = [
  { id: '35', etiqueta: '35', stock: 6 },
  { id: '36', etiqueta: '36', stock: 0 },
  { id: '37', etiqueta: '37', stock: 2 },
  { id: '38', etiqueta: '38', stock: 9 },
  { id: '39', etiqueta: '39', stock: 1 },
  { id: '40', etiqueta: '40', stock: 12 },
]

const PRESETS = [
  { nombre: 'Elite Sport', primary: '#0b0b0c', accent: '#c8ff2e' },
  { nombre: 'Coral urbano', primary: '#1d1230', accent: '#ff5a3c' },
  { nombre: 'Océano', primary: '#06283d', accent: '#4de0ff' },
  { nombre: 'Acento ilegible', primary: '#0b0b0c', accent: '#1a1a1a' },
]

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-10">
      <h2 className="display-lg mb-6 text-3xl md:text-5xl">{titulo}</h2>
      {children}
    </section>
  )
}

type Preset = (typeof PRESETS)[number]

function Muestra({ onPreset }: { onPreset: (p: Preset) => void }) {
  const { brand } = useTheme()
  const [talla, setTalla] = useState<string | null>('38')

  return (
    <div className="container-page py-10">
      <p className="eyebrow">Sistema de diseño</p>
      <h1 className="display-xl mt-2">Elite Sport</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Tinta, hueso y un acento de alto contraste. Tipografía condensada para los títulos, Inter para leer.
      </p>

      <Seccion titulo="Color y tema por tienda">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.nombre} variant="outline" size="sm" onClick={() => onPreset(p)}>
              {p.nombre}
            </Button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Primario', 'bg-brand text-brand-foreground'],
            ['Acento', 'bg-signal text-signal-foreground'],
            ['Superficie', 'bg-card text-card-foreground border border-border'],
            ['Apagado', 'bg-muted text-muted-foreground'],
          ].map(([n, c]) => (
            <div key={n} className={`flex h-24 items-end rounded-md p-3 text-sm font-semibold ${c}`}>
              {n}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
          Contraste acento sobre primario: {contrastRatio(brand.accent, brand.primary).toFixed(1)}:1
          {brand.adjusted ? ' (se ajustó automáticamente para cumplir AA)' : ''}
        </p>
      </Seccion>

      <Seccion titulo="Tipografía">
        <div className="space-y-3">
          <p className="display-lg">Corre más rápido</p>
          <h3 className="text-4xl">Colección urbana</h3>
          <p className="eyebrow">Etiqueta superior</p>
          <p className="max-w-prose">Cuerpo de texto en Inter. Legible en pantallas pequeñas, con buen interlineado y sin adornos.</p>
        </div>
      </Seccion>

      <Seccion titulo="Botones y etiquetas">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Comprar</Button>
          <Button variant="solid">Ver detalle</Button>
          <Button variant="brand">Marca</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Eliminar</Button>
          <Button variant="link">Enlace</Button>
          <Button disabled>Deshabilitado</Button>
          <Button size="icon" aria-label="Favorito"><Heart /></Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge variant="signal">Nuevo</Badge>
          <Badge variant="outline">Contorno</Badge>
          <Badge variant="success">En stock</Badge>
          <Badge variant="warning">Pocas</Badge>
          <Badge variant="destructive">Agotado</Badge>
        </div>
      </Seccion>

      <Seccion titulo="Formularios">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Nombre completo" />
          </div>
          <div>
            <Label htmlFor="grupo">Grupo de talla</Label>
            <Select id="grupo" defaultValue="dama">
              <option value="dama">Dama</option>
              <option value="caballero">Caballero</option>
              <option value="nino">Niño</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="tel">WhatsApp</Label>
            <Input id="tel" aria-invalid="true" defaultValue="09" />
            <FieldError>Ingresa un número de 10 dígitos.</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="nota">Nota</Label>
            <Textarea id="nota" placeholder="Detalle del pedido" />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Tallas y precio">
        <div className="max-w-md">
          <SizeSelector tallas={TALLAS} value={talla} onChange={setTalla} />
          <p className="mt-2 text-xs text-muted-foreground">Punto ámbar: pocas unidades. Tachada: agotada.</p>
        </div>
        <div className="mt-6 flex items-end gap-8">
          <Price amount={89.9} size="lg" />
          <Price amount={74.9} compareAt={99.9} />
          <Price amount={49.9} size="sm" />
        </div>
      </Seccion>

      <Seccion titulo="Tarjetas de producto">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          <ProductCard to="#" producto={{ nombre: 'Runner Pro Veloz', marca: 'Velocity', precio: 89.9, tallas: 'Tallas 38 a 45', destacado: true, colores: ['#0b0b0c', '#c8ff2e', '#e9e6de'] }} />
          <ProductCard to="#" producto={{ nombre: 'Aura Street', marca: 'Elite Sport', precio: 74.9, precioAnterior: 89.9, tallas: 'Tallas 35 a 39' }} />
          <ProductCard to="#" producto={{ nombre: 'Nordik Trail', marca: 'Nordik', precio: 99.9, agotado: true }} />
          <div>
            <Skeleton className="aspect-[4/5]" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Superposiciones y avisos">
        <div className="flex flex-wrap gap-3">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Hoja inferior</SheetTrigger>
            <SheetContent side="bottom" title="Filtros" description="Refina el catálogo.">
              <SizeSelector tallas={TALLAS} value={talla} onChange={setTalla} />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" />}>Panel lateral</SheetTrigger>
            <SheetContent title="Tu carrito" footer={<Button className="w-full">Enviar por WhatsApp</Button>}>
              <EmptyState title="Aún no hay productos" description="Agrega un par para armar tu pedido." />
            </SheetContent>
          </Sheet>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>Diálogo</DialogTrigger>
            <DialogContent title="Confirmar pedido" description="Se descontará del inventario central.">
              <div className="flex justify-end gap-2">
                <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
                <DialogClose render={<Button />}>Confirmar</DialogClose>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => toast.success('Cambios guardados')}>Aviso</Button>
          <Button variant="outline" onClick={() => toast.error('No se pudo guardar')}>Error</Button>
        </div>
      </Seccion>

      <Seccion titulo="Tabla y estado vacío">
        <Table>
          <THead>
            <TR>
              <TH>Producto</TH>
              <TH>Talla</TH>
              <TH className="text-right">Stock</TH>
            </TR>
          </THead>
          <TBody>
            <TR><TD>Runner Pro Veloz</TD><TD>40</TD><TD className="text-right tabular-nums">12</TD></TR>
            <TR><TD>Aura Street</TD><TD>37</TD><TD className="text-right tabular-nums">2</TD></TR>
          </TBody>
        </Table>
        <EmptyState className="mt-6" title="Sin resultados" description="Prueba con otra talla o estilo." />
      </Seccion>
    </div>
  )
}

/** Muestra con el tema de cada preset, para ver cómo reacciona el sistema. */
export function DesignSystemPage() {
  const [brand, setBrand] = useState(PRESETS[0])
  const [vista, setVista] = useState<'publico' | 'panel'>('publico')

  return (
    <ThemeProvider brand={brand}>
      <Toaster />
      <div className="sticky top-0 z-[55] flex items-center justify-center gap-2 bg-foreground p-2 text-background">
        <span className="eyebrow text-background/70">Vista</span>
        <Button size="sm" variant={vista === 'publico' ? 'default' : 'ghost'} className={vista === 'publico' ? '' : 'text-background hover:bg-background/10'} onClick={() => setVista('publico')}>Tienda</Button>
        <Button size="sm" variant={vista === 'panel' ? 'default' : 'ghost'} className={vista === 'panel' ? '' : 'text-background hover:bg-background/10'} onClick={() => setVista('panel')}>Panel</Button>
      </div>
      {vista === 'publico' ? (
        <PublicLayout
          nombre={brand.nombre}
          nav={[
            { to: '/_ds', label: 'Novedades', end: true },
            { to: '/_ds/hombre', label: 'Caballero' },
            { to: '/_ds/mujer', label: 'Dama' },
            { to: '/_ds/ninos', label: 'Niño' },
          ]}
          cartCount={2}
          onSearch={() => undefined}
          footer="Guayaquil, Ecuador. Pedidos por WhatsApp."
        >
          <Muestra onPreset={setBrand} />
        </PublicLayout>
      ) : (
        <PanelLayout
          nombre={brand.nombre}
          seccion="Administración"
          nav={[
            { to: '/_ds', label: 'Resumen', icon: LayoutGrid, end: true },
            { to: '/_ds/productos', label: 'Productos', icon: Package },
            { to: '/_ds/mayoristas', label: 'Mayoristas', icon: Users },
            { to: '/_ds/ajustes', label: 'Ajustes', icon: Settings },
          ]}
        >
          <Muestra onPreset={setBrand} />
        </PanelLayout>
      )}
    </ThemeProvider>
  )
}
