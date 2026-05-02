/** Toggle a chrome-less mode for screenshots / portfolio captures.
 *
 * Cmd/Ctrl + Shift + S adds the `screenshot-mode` class to <html>; styles in
 * index.css hide the header, footer, and any floating chrome elements.
 * Pressing the chord again restores normal view. */

import { useEffect, useState } from 'react'

const ATTR = 'screenshot-mode'

export function useScreenshotMode(): boolean {
  const [on, setOn] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      const isS = e.key === 'S' || e.key === 's'
      if (isS && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOn((prev) => {
          const next = !prev
          document.documentElement.classList.toggle(ATTR, next)
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return on
}
