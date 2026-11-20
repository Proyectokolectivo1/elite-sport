import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { aFechaInput, periodo } from '../logica'

/** Periodo Desde/Hasta (fechas del navegador). Arranca en hoy. */
export function usePeriodo() {
  const [hoy] = useState(() => aFechaInput(new Date()))
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const rango = useMemo(() => periodo(desde, hasta), [desde, hasta])
  return { desde, hasta, setDesde, setHasta, rango }
}

type Periodo = ReturnType<typeof usePeriodo>

/** Campos Desde/Hasta con atajos Hoy, Ayer, 7 días y Este mes. */
export function SelectorPeriodo({ p, id }: { p: Periodo; id: string }) {
  function ultimosDias(dias: number) {
    const f = new Date()
    f.setDate(f.getDate() - dias)
    p.setDesde(aFechaInput(f))
    p.setHasta(aFechaInput(dias === 1 ? f : new Date()))
  }
  function esteMes() {
    const f = new Date()
    p.setDesde(aFechaInput(new Date(f.getFullYear(), f.getMonth(), 1)))
    p.setHasta(aFechaInput(f))
  }
  return (
    <section aria-label="Periodo" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
      <div>
        <Label htmlFor={`${id}-desde`}>Desde</Label>
        <Input id={`${id}-desde`} type="date" value={p.desde} max={p.hasta} onChange={(e) => p.setDesde(e.target.value)} />
      </div>
      <div>
        <Label htmlFor={`${id}-hasta`}>Hasta</Label>
        <Input id={`${id}-hasta`} type="date" value={p.hasta} min={p.desde} onChange={(e) => p.setHasta(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => ultimosDias(0)}>Hoy</Button>
        <Button variant="outline" size="sm" onClick={() => ultimosDias(1)}>Ayer</Button>
        <Button variant="outline" size="sm" onClick={() => ultimosDias(6)}>7 días</Button>
        <Button variant="outline" size="sm" onClick={esteMes}>Este mes</Button>
      </div>
    </section>
  )
}
