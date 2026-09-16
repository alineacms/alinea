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
}

export interface TypePickerPanelProps<Item extends TypePickerItem> {
  items: Array<Item>
  label: string
  onSelect: (item: Item) => void
}

export function TypePickerPanel<Item extends TypePickerItem>({
  items,
  label,
  onSelect
}: TypePickerPanelProps<Item>) {
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
          {item => (
            <TypePickerAction key={item.id} item={item} onSelect={onSelect} />
          )}
        </ListBox>
      </Autocomplete>
    </div>
  )
}

function containsTypeLabel(textValue: string, inputValue: string): boolean {
  return textValue.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase())
}

interface TypePickerActionProps<Item extends TypePickerItem> {
  item: Item
  onSelect: (item: Item) => void
}

function TypePickerAction<Item extends TypePickerItem>({
  item,
  onSelect
}: TypePickerActionProps<Item>) {
  const overlay = useContext(OverlayTriggerStateContext)
  return (
    <ListBoxItem
      className={styles.TypePicker.item()}
      id={item.id}
      onAction={() => {
        onSelect(item)
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

export interface TypePickerProps<
  Item extends TypePickerItem
> extends TypePickerPanelProps<Item> {
  onOpenChange?: (isOpen: boolean) => void
  trigger: ReactNode
}

export function TypePicker<Item extends TypePickerItem>({
  items,
  label,
  onOpenChange,
  onSelect,
  trigger
}: TypePickerProps<Item>) {
  const [isOpen, setIsOpen] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setIsOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger}
      <Popover className={styles.TypePicker.popover()} placement="bottom left">
        <Dialog className={styles.TypePicker.dialog()}>
          <TypePickerPanel items={items} label={label} onSelect={onSelect} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
