import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme/ThemeProvider'

export function ModeToggle({ className }: { className?: string }) {
  const { resolvedMode, setMode } = useTheme()
  const oscuro = resolvedMode === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={() => setMode(oscuro ? 'light' : 'dark')}
    >
      {oscuro ? <Sun /> : <Moon />}
    </Button>
  )
}
