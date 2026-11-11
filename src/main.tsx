import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { injectSpeedInsights } from '@vercel/speed-insights'
import App from './App'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import './styles/index.css'

// Los datos se reutilizan 30 s antes de volver a pedirlos: menos consultas al navegar entre páginas.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

// Mide la velocidad real de los visitantes (Core Web Vitals). Solo envía datos en producción en Vercel.
if (import.meta.env.PROD && !['localhost', '127.0.0.1'].includes(location.hostname)) injectSpeedInsights()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
