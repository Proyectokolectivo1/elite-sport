import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import type { DatosCliente } from '../datosCliente'

interface Props {
  register: UseFormRegister<DatosCliente>
  errors: FieldErrors<DatosCliente>
  /** Prefijo para los id, así dos formularios en pantalla no chocan. */
  prefijo: string
}

/** Campos del cliente que se piden en cualquier pedido hecho por la web. */
export function CamposCliente({ register, errors, prefijo }: Props) {
  const id = (n: string) => `${prefijo}-${n}`
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={id('nombre')}>Nombre completo</Label>
        <Input id={id('nombre')} autoComplete="name" aria-invalid={!!errors.nombre} {...register('nombre')} />
        <FieldError>{errors.nombre?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor={id('documento')}>Cédula o RUC</Label>
        <Input id={id('documento')} inputMode="numeric" autoComplete="off" aria-invalid={!!errors.documento} {...register('documento')} />
        <FieldError>{errors.documento?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor={id('telefono')}>Celular</Label>
        <Input id={id('telefono')} type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!errors.telefono} {...register('telefono')} />
        <FieldError>{errors.telefono?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor={id('correo')}>Correo</Label>
        <Input id={id('correo')} type="email" autoComplete="email" aria-invalid={!!errors.correo} {...register('correo')} />
        <FieldError>{errors.correo?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor={id('direccion')}>Dirección de entrega</Label>
        <Input id={id('direccion')} autoComplete="street-address" aria-invalid={!!errors.direccion} {...register('direccion')} />
        <FieldError>{errors.direccion?.message}</FieldError>
      </div>
      <div>
        <Label htmlFor={id('nota')}>Nota (opcional)</Label>
        <Textarea id={id('nota')} className="min-h-20" {...register('nota')} />
        <FieldError>{errors.nota?.message}</FieldError>
      </div>
    </div>
  )
}
