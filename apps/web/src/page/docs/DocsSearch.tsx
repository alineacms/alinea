'use client'

import styler from '@alinea/styler'
import {useEffect, useRef} from 'react'
import {SearchButton} from '@/layout/Header.client'
import css from './DocsSearch.module.scss'
import {DocsIconSearch} from './DocsIcons'

const styles = styler(css)

export function DocsSearch() {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      ref.current?.click()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  return (
    <SearchButton>
      <button ref={ref} type="button" className={styles.root()}>
        <DocsIconSearch className={styles.root.icon()} />
        <span className={styles.root.label()}>Search the docs</span>
        <kbd className={styles.root.shortcut()}>⌘K</kbd>
      </button>
    </SearchButton>
  )
}
