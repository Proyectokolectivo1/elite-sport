import { useEffect } from 'react'

/** SEO básico por página: título y descripción. */
export function usePageMeta(titulo: string, descripcion?: string): void {
  useEffect(() => {
    document.title = titulo
    if (!descripcion) return
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }
    tag.content = descripcion
  }, [titulo, descripcion])
}
