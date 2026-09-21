import styler from '@alinea/styler'
import type {ComponentType, ReactNode} from 'react'
import {useContext, useState} from 'react'
import {
  Autocomplete,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  OverlayTriggerStateContext
} from 'react-aria-components'
import {Icon} from './Icon.js'
import {ListTypeIcon} from './List.js'
import {Popover} from './Popover.js'
import {SearchField} from './SearchField.js'
import css from './TypePicker.module.css'

const styles = styler(css)

export interface TypePickerItem {
  colorName?: string
  icon: ComponentType
  id: string
  label: string
  onSelect: () => void
}

export interface TypePickerPanelProps {
  items: Array<TypePickerItem>
  label: string
}

export function TypePickerPanel({items, label}: TypePickerPanelProps) {
  return (
    <div className={styles.TypePicker.dialog()}>
      <Autocomplete filter={containsTypeLabel}>
        <SearchField
          aria-label="Search types"
          autoFocus
          className={styles.TypePicker.search()}
          hasIcon
          placeholder="Search types..."
        />
        <ListBox
          aria-label={label}
          className={styles.TypePicker.list()}
          items={items}
          renderEmptyState={() => (
            <div className={styles.TypePicker.empty()}>No matching types</div>
          )}
        >
          {item => <TypePickerAction key={item.id} item={item} />}
        </ListBox>
      </Autocomplete>
    </div>
  )
}

function containsTypeLabel(textValue: string, inputValue: string): boolean {
  return textValue.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase())
}

interface TypePickerActionProps {
  item: TypePickerItem
}

function TypePickerAction({item}: TypePickerActionProps) {
  const overlay = useContext(OverlayTriggerStateContext)
  return (
    <ListBoxItem
      className={styles.TypePicker.item()}
      id={item.id}
      onAction={() => {
        item.onSelect()
        overlay?.close()
      }}
      textValue={item.label}
    >
      {item.colorName ? (
        <ListTypeIcon icon={item.icon} name={item.colorName} />
      ) : (
        <Icon
          aria-hidden
          className={styles.TypePicker.item.icon()}
          icon={item.icon}
        />
      )}
      <span>{item.label}</span>
    </ListBoxItem>
  )
}

export interface TypePickerProps extends TypePickerPanelProps {
  onOpenChange?: (isOpen: boolean) => void
  trigger: ReactNode
}

export function TypePicker({
  items,
  label,
  onOpenChange,
  trigger
}: TypePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger}
      <Popover className={styles.TypePicker.popover()} placement="bottom left">
        <Dialog>
          <TypePickerPanel items={items} label={label} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
