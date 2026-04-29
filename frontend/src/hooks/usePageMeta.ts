/** Sets document.title and meta description per route. */

import { useEffect } from 'react'

export interface PageMeta {
  title: string
  description?: string
}

const BASE = 'Battery Market Maker'

export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title === BASE ? title : `${title} · ${BASE}`
    let metaDesc: HTMLMetaElement | null = null
    let prevDesc: string | null = null
    if (description) {
      metaDesc = document.querySelector('meta[name="description"]')
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.name = 'description'
        document.head.appendChild(metaDesc)
      }
      prevDesc = metaDesc.content
      metaDesc.content = description
    }
    return () => {
      document.title = prevTitle
      if (metaDesc && prevDesc !== null) metaDesc.content = prevDesc
    }
  }, [title, description])
}
