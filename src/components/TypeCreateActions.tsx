import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {IcRoundMoreHoriz} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {ListCreateButton} from './List.js'
import {TypePicker, type TypePickerPanelProps} from './TypePicker.js'
import css from './TypeCreateActions.module.css'

const styles = styler(css)

export interface TypeCreateActionsProps extends TypePickerPanelProps {
  leading?: ReactNode
  visibleCount?: number
}

export function TypeCreateActions({
  items,
  label,
  leading,
  visibleCount = 3
}: TypeCreateActionsProps) {
  const visibleItems = items.slice(0, visibleCount)
  const hasMore = items.length > visibleItems.length
  return (
    <div
      aria-label={label}
      className={styles.TypeCreateActions()}
      role="toolbar"
    >
      {leading}
      {visibleItems.map(item => (
        <ListCreateButton
          className={styles.TypeCreateActions.button()}
          icon={item.icon}
          key={item.id}
          name={item.colorName ?? item.label}
          onPress={item.onSelect}
        >
          {item.label}
        </ListCreateButton>
      ))}
      {hasMore && (
        <TypePicker
          items={items}
          label={label}
          trigger={
            <Button
              appearance="plain"
              className={styles.TypeCreateActions.button()}
              icon={IcRoundMoreHoriz}
              size="small"
            >
              More
            </Button>
          }
        />
      )}
    </div>
  )
}
