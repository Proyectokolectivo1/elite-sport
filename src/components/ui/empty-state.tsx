import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-md bg-muted/50 px-6 py-10',
        className,
      )}
    >
      <h3 className="text-2xl">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
