'use client'

import styler from '@alinea/styler'
import {
  type KeyboardEvent,
  type ReactNode,
  useDeferredValue,
  useId,
  useRef,
  useState
} from 'react'
import {DocsIconClose, DocsIconSearch} from '@/page/docs/DocsIcons'
import css from './CatalogBrowser.module.scss'

const styles = styler(css)

export interface CatalogBrowserGroup {
  id: string
  /** Label of the filter tab */
  label: string
  /** Heading above the cards of the group */
  title: string
}

export interface CatalogBrowserItem {
  key: string
  group: string
  /** Text the search matches against */
  search: string
  card: ReactNode
}

export interface CatalogBrowserProps {
  /** Accessible name of the filter tabs, eg. "Filter fields" */
  label: string
  groups: Array<CatalogBrowserGroup>
  items: Array<CatalogBrowserItem>
  /** Shows a search box with this placeholder */
  searchPlaceholder?: string
  /** Noun for the result count, eg. "components" */
  noun: string
}

function matches(item: CatalogBrowserItem, query: string) {
  const text = item.search.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(word => text.includes(word))
}

/**
 * Filter tabs, an optional search box and the cards grouped under headings.
 * Every card stays mounted and is hidden when filtered out, so previews that
 * already loaded are kept.
 */
export function CatalogBrowser({
  label,
  groups,
  items,
  searchPlaceholder,
  noun
}: CatalogBrowserProps) {
  const id = useId()
  const [tab, setTab] = useState('all')
  const [input, setInput] = useState('')
  const query = useDeferredValue(input.trim())
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabs = [{id: 'all', label: 'All'}, ...groups]
  const visible = new Set(
    items
      .filter(item => tab === 'all' || item.group === tab)
      .filter(item => !query || matches(item, query))
      .map(item => item.key)
  )
  const showHeadings = tab === 'all'

  function select(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length]
    setTab(next.id)
    const buttons = tabsRef.current?.querySelectorAll('button')
    buttons?.[(index + tabs.length) % tabs.length]?.focus()
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex(item => item.id === tab)
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    select(keys[event.key])
  }

  return (
    <div className={styles.root()}>
      <div className={styles.root.controls()}>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={label}
          className={styles.root.tabs()}
        >
          {tabs.map(item => {
            const selected = item.id === tab
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${id}-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                className={styles.root.tab({selected})}
                onClick={() => setTab(item.id)}
                onKeyDown={onTabKeyDown}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        {searchPlaceholder && (
          <label className={styles.root.search()}>
            <DocsIconSearch className={styles.root.search.icon()} />
            <input
              type="search"
              value={input}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={`${id}-panel`}
              className={styles.root.search.input()}
              onChange={event => setInput(event.target.value)}
            />
          </label>
        )}
      </div>
      <p className={styles.root.status()} aria-live="polite">
        {query ? `${visible.size} ${noun} found` : ''}
      </p>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        className={styles.root.panel()}
      >
        {groups.map(group => {
          const groupItems = items.filter(item => item.group === group.id)
          const hidden = !groupItems.some(item => visible.has(item.key))
          return (
            <section
              key={group.id}
              hidden={hidden}
              aria-labelledby={showHeadings ? `${id}-${group.id}` : undefined}
              aria-label={showHeadings ? undefined : group.title}
              className={styles.root.group()}
            >
              {showHeadings && (
                <h2 id={`${id}-${group.id}`} className={styles.root.heading()}>
                  {group.title}
                </h2>
              )}
              <ul className={styles.root.grid()}>
                {groupItems.map(item => (
                  <li
                    key={item.key}
                    hidden={!visible.has(item.key)}
                    className={styles.root.item()}
                  >
                    {item.card}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {visible.size === 0 && (
          <div className={styles.root.empty()}>
            <p>
              No {noun} match <strong>“{query}”</strong>
              {tab !== 'all' && ' in this group'}.
            </p>
            <button
              type="button"
              className={styles.root.empty.clear()}
              onClick={() => {
                setInput('')
                setTab('all')
              }}
            >
              <DocsIconClose className={styles.root.empty.clear.icon()} />
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
