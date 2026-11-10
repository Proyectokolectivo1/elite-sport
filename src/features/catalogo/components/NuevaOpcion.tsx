import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import type { TablaOpciones } from '../api/catalogo'
import { useCrearOpcion } from '../hooks/useCatalogo'

/** Alta rápida de una marca, categoría o estilo sin salir del formulario. */
export function NuevaOpcion({ tabla, etiqueta }: { tabla: TablaOpciones; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const crear = useCrearOpcion(tabla)

  async function guardar() {
    try {
      await crear.mutateAsync(nombre)
      toast.success(`${etiqueta} creada`)
      setNombre('')
      setAbierto(false)
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button type="button" variant="link" className="mb-1.5 text-xs" />}>Nueva</DialogTrigger>
      <DialogContent title={`Nueva ${etiqueta.toLowerCase()}`}>
        <Label htmlFor="nueva-opcion">Nombre</Label>
        <Input id="nueva-opcion" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button disabled={nombre.trim().length < 2 || crear.isPending} onClick={() => void guardar()}>Crear</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
