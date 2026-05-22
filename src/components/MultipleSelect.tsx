import styler from '@alinea/styler'
import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState
} from 'react'
import {
  Autocomplete,
  Button,
  Group,
  Input,
  type Key,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  SearchField as SearchFieldPrimitive,
  Select as SelectPrimitive,
  type SelectProps as SelectPrimitiveProps,
  SelectValue,
  TagGroup,
  TagList,
  useFilter
} from 'react-aria-components'
import type {ListData} from 'react-stately'
import {
  IcRoundCheck,
  IcRoundClose,
  IcRoundKeyboardArrowDown,
  IcRoundSearch
} from '../dashboard/icons.js'
import {Icon} from './Icon.js'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import {Popover} from './Popover.js'

import css from './MultipleSelect.module.css'

const styles = styler(css)

export interface SelectedKey {
  id: Key
  name: string
}

interface MultipleSelectProps<T extends object>
  extends
    LabelSharedProps,
    Omit<
      SelectPrimitiveProps<T, 'multiple'>,
      | 'children'
      | 'className'
      | 'defaultSelectedKey'
      | 'defaultValue'
      | 'onChange'
      | 'onSelectionChange'
      | 'selectedKey'
      | 'selectionMode'
      | 'value'
    > {
  items: Array<T>
  selectedItems: ListData<T>
  className?: string
  onItemInserted?: (key: Key) => void
  onItemCleared?: (key: Key) => void
  renderEmptyState?: (inputValue: string) => React.ReactNode
  tag: (item: T) => React.ReactNode
  children: React.ReactNode | ((item: T) => React.ReactNode)
  placeholder?: string
}

export function MultipleSelect<T extends SelectedKey>({
  children,
  items,
  selectedItems,
  onItemCleared,
  onItemInserted,
  className,
  name,
  renderEmptyState,
  ...props
}: MultipleSelectProps<T>) {
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null)
  const [search, setSearch] = useState('')
  const {contains} = useFilter({sensitivity: 'base'})
  const selectedKeys = selectedItems.items.map(item => item.id)
  const selectLabel =
    props['aria-label'] ??
    (typeof props.label === 'string' ? props.label : 'Available items')

  const onChange = useCallback(
    (keys: Key[]) => {
      const previousKeys = new Set(selectedKeys)
      const nextKeys = new Set(keys)
      const removedKeys = selectedKeys.filter(key => !nextKeys.has(key))
      const insertedKeys = keys.filter(key => !previousKeys.has(key))

      if (removedKeys.length > 0) {
        selectedItems.remove(...removedKeys)
        for (const key of removedKeys) onItemCleared?.(key)
      }

      const insertedItems = insertedKeys
        .map(key => items.find(item => item.id === key))
        .filter((item): item is T => Boolean(item))

      if (insertedItems.length > 0) {
        selectedItems.append(...insertedItems)
        for (const item of insertedItems) onItemInserted?.(item.id)
      }
      setSearch('')
    },
    [items, onItemCleared, onItemInserted, selectedItems, selectedKeys]
  )

  const onFieldPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('button, [role="row"]')) return
      triggerButtonRef.current?.click()
    },
    []
  )

  return (
    <>
      <SelectPrimitive
        {...props}
        aria-label={selectLabel}
        className={styles.MultipleSelect.select(styler.merge({className}))}
        onChange={onChange}
        selectionMode="multiple"
        value={selectedKeys}
      >
        <Label {...labelProps(props)}>
          <Group
            aria-label={selectLabel}
            className={styles.MultipleSelect.container()}
            onPointerDown={onFieldPointerDown}
            ref={triggerRef}
          >
            <SelectValue<T> className={styles.MultipleSelect.value()}>
              {({selectedItems, state}) => {
                const tagItems = selectedItems.filter(
                  (item): item is T => item !== null
                )
                return (
                  <TagGroup
                    aria-label="Selected items"
                    className={styles.MultipleSelect.tagGroup()}
                    onRemove={keys => {
                      if (Array.isArray(state.value)) {
                        state.setValue(
                          state.value.filter(key => !keys.has(key))
                        )
                      }
                    }}
                  >
                    <TagList
                      className={styles.MultipleSelect.tagGroup.tagList()}
                      items={tagItems}
                      renderEmptyState={() => (
                        <span className={styles.MultipleSelect.placeholder()}>
                          {props.placeholder}
                        </span>
                      )}
                    >
                      {props.tag}
                    </TagList>
                  </TagGroup>
                )
              }}
            </SelectValue>
            <Button
              className={styles.MultipleSelect.trigger()}
              ref={triggerButtonRef}
            >
              <Icon
                icon={IcRoundKeyboardArrowDown}
                className={styles.MultipleSelect.trigger.icon()}
              />
            </Button>
          </Group>
          <Popover
            className={styles.MultipleSelectPopover()}
            triggerRef={triggerRef}
          >
            <Autocomplete filter={contains}>
              <SearchFieldPrimitive
                aria-label="Search options"
                autoFocus
                className={styles.MultipleSelectPopover.search()}
                onChange={setSearch}
              >
                <div className={styles.MultipleSelectPopover.search.field()}>
                  <Icon
                    icon={IcRoundSearch}
                    className={styles.MultipleSelectPopover.search.icon()}
                  />
                  <Input
                    className={styles.MultipleSelectPopover.search.input()}
                    placeholder="Search"
                  />
                  <Button
                    className={styles.MultipleSelectPopover.search.clear()}
                  >
                    <Icon
                      icon={IcRoundClose}
                      className={styles.MultipleSelectPopover.search.clear.icon()}
                    />
                  </Button>
                </div>
              </SearchFieldPrimitive>
              <ListBox
                className={styles.MultipleSelectPopover.listbox()}
                items={items}
                renderEmptyState={() =>
                  renderEmptyState ? (
                    renderEmptyState(search)
                  ) : (
                    <p className={styles.MultipleSelectPopover.empty()}>
                      No options
                    </p>
                  )
                }
              >
                {children}
              </ListBox>
            </Autocomplete>
          </Popover>
        </Label>
      </SelectPrimitive>
      {name && (
        <input hidden name={name} value={selectedKeys.join(',')} readOnly />
      )}
    </>
  )
}

export interface MultipleSelectItemProps extends ListBoxItemProps {
  children: ReactNode
}

export function MultipleSelectItem({
  children,
  ...props
}: MultipleSelectItemProps) {
  return (
    <ListBoxItem
      className={styles.MultipleSelectItem()}
      textValue={typeof children === 'string' ? children : props.textValue}
      {...props}
    >
      {({isSelected}) => (
        <>
          {isSelected && (
            <IcRoundCheck className={styles.MultipleSelectItem.check()} />
          )}
          {children}
        </>
      )}
    </ListBoxItem>
  )
}
