import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {IcRoundMoreHoriz} from '#/dashboard/icons.js'
import {Button} from './Button.js'
import {ListCreateButton} from './List.js'
import {
  TypePicker,
  type TypePickerItem,
  type TypePickerPanelProps
} from './TypePicker.js'
import css from './TypeCreateActions.module.css'

const styles = styler(css)

export interface TypeCreateActionsProps<
  Item extends TypePickerItem
> extends TypePickerPanelProps<Item> {
  leading?: ReactNode
  visibleCount?: number
}

export function TypeCreateActions<Item extends TypePickerItem>({
  items,
  label,
  leading,
  onSelect,
  visibleCount = 3
}: TypeCreateActionsProps<Item>) {
  const visibleItems = items.slice(0, visibleCount)
  const hasMore = items.length > visibleItems.length
  return (
    <div
      aria-label={label}
      className={styles.TypeCreateActions()}
      role="toolbar"
    >
      {leading && (
        <div className={styles.TypeCreateActions.leading()}>{leading}</div>
      )}
      {visibleItems.map(item => (
        <ListCreateButton
          className={styles.TypeCreateActions.button()}
          icon={item.icon}
          key={item.id}
          name={item.colorName ?? item.label}
          onPress={() => onSelect(item)}
        >
          {item.label}
        </ListCreateButton>
      ))}
      {hasMore && (
        <TypePicker
          items={items}
          label={label}
          onSelect={onSelect}
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
