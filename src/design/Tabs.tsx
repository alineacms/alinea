import styler from '@alinea/styler'
import {type ReactNode, useId, useState} from 'react'
import css from './Tabs.module.css'

const styles = styler(css)

export interface TabItem {
  content: ReactNode
  disabled?: boolean
  id: string
  label: ReactNode
}

export interface TabsProps {
  defaultSelectedId?: string
  items: ReadonlyArray<TabItem>
  variant?: 'line' | 'subtle' | 'enclosed'
}

export function Tabs({defaultSelectedId, items, variant = 'line'}: TabsProps) {
  const uniqueId = useId().replace(/:/g, '')
  const firstEnabledItem = items.find(item => !item.disabled)
  const [selectedId, setSelectedId] = useState(
    defaultSelectedId ?? firstEnabledItem?.id
  )
  const selectedItem =
    items.find(item => item.id === selectedId) ?? firstEnabledItem

  return (
    <div className={styles['alinea-Tabs']()}>
      <div
        aria-label="Sections"
        className={styles['alinea-Tabs-list']()}
        data-variant={variant}
        role="tablist"
      >
        {items.map(item => {
          const isSelected = item.id === selectedItem?.id
          return (
            <button
              aria-controls={`${uniqueId}-${item.id}-panel`}
              aria-selected={isSelected}
              className={styles['alinea-Tabs-tab']()}
              data-disabled={item.disabled ? '' : undefined}
              data-selected={isSelected ? '' : undefined}
              data-variant={variant}
              disabled={item.disabled}
              id={`${uniqueId}-${item.id}-tab`}
              key={item.id}
              role="tab"
              type="button"
              onClick={() => setSelectedId(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {selectedItem && (
        <div
          aria-labelledby={`${uniqueId}-${selectedItem.id}-tab`}
          className={styles['alinea-Tabs-panel']()}
          id={`${uniqueId}-${selectedItem.id}-panel`}
          role="tabpanel"
          tabIndex={0}
        >
          {selectedItem.content}
        </div>
      )}
    </div>
  )
}
