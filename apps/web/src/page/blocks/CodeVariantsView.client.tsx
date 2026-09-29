'use client'

import styler from '@alinea/styler'
import {useId, useSyncExternalStore} from 'react'
import css from './CodeVariantsView.module.scss'
import {CodeCopyButton} from './code/CodeCopyButton'

const styles = styler(css)

// The chosen variant (eg. a package manager) is shared by every tab set on
// the page and remembered in this browser
const preferenceKey = '@alinea/codevariant'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getPreference() {
  try {
    return localStorage.getItem(preferenceKey)
  } catch {
    return null
  }
}

function setPreference(name: string) {
  try {
    localStorage.setItem(preferenceKey, name)
  } catch {
    // Without storage the choice is not remembered
  }
  for (const listener of listeners) listener()
}

export interface CodeVariant {
  id: string
  name: string
  code: string
  html: string
}

export interface CodeVariantTabsProps {
  variants: Array<CodeVariant>
}

export function CodeVariantTabs({variants}: CodeVariantTabsProps) {
  const id = useId()
  const preference = useSyncExternalStore(subscribe, getPreference, () => null)
  const selected =
    variants.find(variant => variant.name === preference) ?? variants[0]
  return (
    <div className={styles.root()}>
      <div className={styles.bar()}>
        <div role="tablist" className={styles.tabs()}>
          {variants.map(variant => {
            const isSelected = variant.id === selected.id
            return (
              <button
                key={variant.id}
                type="button"
                role="tab"
                id={`${id}-${variant.id}`}
                aria-selected={isSelected}
                aria-controls={`${id}-panel`}
                className={styles.tab({selected: isSelected})}
                onClick={() => setPreference(variant.name)}
              >
                {variant.name}
              </button>
            )
          })}
        </div>
        <CodeCopyButton code={selected.code} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${selected.id}`}
        className={styles.body()}
        dangerouslySetInnerHTML={{__html: selected.html}}
      />
    </div>
  )
}
