'use client'

import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import css from './DocToc.module.scss'

const styles = styler(css)

export interface DocTocItem {
  id: string
  title: string
}

export interface DocTocProps {
  items: Array<DocTocItem>
}

export function DocToc({items}: DocTocProps) {
  const [activeId, setActiveId] = useState(items[0]?.id)
  useEffect(() => {
    const headings = items
      .map(item => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null)
    if (headings.length === 0) return
    function update() {
      // The active heading is the last one scrolled past the top third
      const threshold = window.innerHeight / 3
      let current = headings[0]
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > threshold) break
        current = heading
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      setActiveId(atBottom ? headings[headings.length - 1].id : current.id)
    }
    update()
    window.addEventListener('scroll', update, {passive: true})
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items])
  if (items.length === 0) return null
  return (
    <nav aria-label="On this page" className={styles.root()}>
      <span className={styles.title()}>On this page</span>
      <div className={styles.list()}>
        {items.map(item => {
          const isActive = item.id === activeId
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? 'location' : undefined}
              className={styles.link({active: isActive})}
            >
              {item.title}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
