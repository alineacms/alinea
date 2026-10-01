'use client'

import styler from '@alinea/styler'
import {usePathname} from 'next/navigation'
import {type PropsWithChildren, useEffect, useLayoutEffect, useRef} from 'react'
import css from './DocsSidebar.module.scss'

const styles = styler(css)

const storageKey = 'alinea-docs-sidebar-scroll'

function readScroll(): number | undefined {
  try {
    const value = Number(sessionStorage.getItem(storageKey))
    return Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

function writeScroll(value: number) {
  try {
    sessionStorage.setItem(storageKey, String(Math.round(value)))
  } catch {}
}

/** Scrolls the container just enough to show the active link */
function revealActive(container: HTMLElement) {
  const active = container.querySelector<HTMLElement>('[aria-current="page"]')
  if (!active) return
  const box = container.getBoundingClientRect()
  const item = active.getBoundingClientRect()
  const margin = 48
  const top = box.top + margin
  if (item.top < top) container.scrollTop -= top - item.top
  else if (item.bottom > box.bottom - margin)
    container.scrollTop += item.bottom - (box.bottom - margin)
}

// useLayoutEffect warns during server rendering
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The docs sidebar lives in the docs layout, so it stays mounted (and keeps
 * its scroll position) while navigating between docs pages. On a fresh load
 * the last scroll position of this tab is restored and the active link is
 * revealed if it ended up out of view.
 */
export function DocsSidebar({children}: PropsWithChildren) {
  const ref = useRef<HTMLElement>(null)
  const pathname = usePathname()
  useIsomorphicLayoutEffect(() => {
    const container = ref.current
    if (!container) return
    const saved = readScroll()
    if (saved !== undefined) container.scrollTop = saved
    revealActive(container)
  }, [])
  // Navigating from outside the sidebar (eg. the next page link) can activate
  // a link that is scrolled out of view
  const isFirst = useRef(true)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const container = ref.current
    if (container) revealActive(container)
  }, [pathname])
  useEffect(() => {
    const container = ref.current
    if (!container) return
    let frame = 0
    function handleScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => writeScroll(container!.scrollTop))
    }
    container.addEventListener('scroll', handleScroll, {passive: true})
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])
  return (
    <aside ref={ref} className={styles.root()}>
      {children}
    </aside>
  )
}
