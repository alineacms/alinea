'use client'

import {type ReactNode, useEffect, useRef} from 'react'

export interface DemoHeaderNavProps {
  className?: string
  label: string
  children: ReactNode
}

/**
 * The header links, which scroll sideways on narrow screens. Scrolls the
 * current page's link into view so it is not hidden past the edge.
 */
export function DemoHeaderNav({
  className,
  label,
  children
}: DemoHeaderNavProps) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = ref.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    // Clear the edge fade (32px, see DemoHeader.module.scss) as well
    const end = active.offsetLeft + active.offsetWidth + 32
    if (end > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = end - nav.clientWidth
  }, [])
  return (
    <nav ref={ref} className={className} aria-label={label}>
      {children}
    </nav>
  )
}
