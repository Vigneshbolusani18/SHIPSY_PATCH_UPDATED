'use client'
import { useEffect, useLayoutEffect } from 'react'

// Run before paint on the client; fall back to useEffect on the server
const useIsoLayout =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Sets a fixed background via CSS variables on <body>.
 * No DOM layers are rendered, so nothing flickers on route changes.
 */
export default function DynamicBackground({
  image = '/bg.jpg',
  position = 'center',
  size = 'cover',
  repeat = 'no-repeat',
  overlay = 'none',   // e.g. 'linear-gradient(...)'
  blur = '0px',       // e.g. '2px'
}) {
  useIsoLayout(() => {
    const b = document.body
    if (!b) return

    // Mark body to enable CSS background/overlay via variables
    b.classList.add('has-dynamic-bg')

    // Apply variables (persist between routes; no cleanup)
    b.style.setProperty('--dynamic-bg-image', `url("${image}")`)
    b.style.setProperty('--dynamic-bg-position', position)
    b.style.setProperty('--dynamic-bg-size', size)
    b.style.setProperty('--dynamic-bg-repeat', repeat)
    b.style.setProperty('--dynamic-bg-overlay', overlay)
    b.style.setProperty('--dynamic-bg-blur', blur)

    // Do NOT remove on unmount — prevents flashes during route switches
    return () => {}
  }, [image, position, size, repeat, overlay, blur])

  // Nothing to render; background is handled by body CSS
  return null
}
