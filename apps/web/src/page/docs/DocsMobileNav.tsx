'use client'

import styler from '@alinea/styler'
import {usePathname} from 'next/navigation'
import {type PropsWithChildren, useEffect, useRef} from 'react'
import {DocsIconChevronRight, DocsIconClose, DocsIconMenu} from './DocsIcons'
import css from './DocsMobileNav.module.scss'

const styles = styler(css)

export interface DocsMobileNavPage {
  url: string
  title: string
}

export interface DocsMobileNavProps {
  pages: Array<DocsMobileNavPage>
}

/**
 * Below the desktop breakpoint the docs sidebar is replaced by a bar that
 * opens the navigation in a modal drawer. The native dialog traps focus,
 * closes on escape and returns focus to the menu button when it closes.
 */
export function DocsMobileNav({
  pages,
  children
}: PropsWithChildren<DocsMobileNavProps>) {
  const pathname = usePathname()
  const dialog = useRef<HTMLDialogElement>(null)
  const current = pages.find(page => page.url === pathname)
  useEffect(() => {
    dialog.current?.close()
  }, [pathname])
  function open() {
    const element = dialog.current
    if (!element) return
    element.showModal()
    element
      .querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({block: 'center'})
  }
  function close() {
    dialog.current?.close()
  }
  return (
    <div className={styles.root()}>
      <button
        type="button"
        className={styles.root.trigger()}
        aria-haspopup="dialog"
        onClick={open}
      >
        <DocsIconMenu className={styles.root.trigger.icon()} />
        <span>Menu</span>
      </button>
      {current && (
        <>
          <DocsIconChevronRight
            className={styles.root.separator()}
            aria-hidden="true"
          />
          <span className={styles.root.current()}>{current.title}</span>
        </>
      )}
      <dialog
        ref={dialog}
        className={styles.drawer()}
        aria-label="Documentation"
        onClick={event => {
          // Clicks on the backdrop target the dialog element itself
          if (event.target === event.currentTarget) close()
        }}
      >
        <div className={styles.drawer.panel()}>
          <div className={styles.drawer.header()}>
            <span className={styles.drawer.title()}>Documentation</span>
            <button
              type="button"
              className={styles.drawer.close()}
              aria-label="Close menu"
              onClick={close}
            >
              <DocsIconClose />
            </button>
          </div>
          <div className={styles.drawer.body()}>{children}</div>
        </div>
      </dialog>
    </div>
  )
}
