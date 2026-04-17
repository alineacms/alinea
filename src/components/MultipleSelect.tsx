import styler from '@alinea/styler'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react'
import {useFilter} from 'react-aria'
import {
  Button,
  ComboBox,
  type ComboBoxProps as ComboBoxPrimitiveProps,
  Input,
  type Key,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  TagGroup,
  TagList
} from 'react-aria-components'
import {type ListData, useListData} from 'react-stately'
import {IcRoundCheck} from '../stories/icons/IcRoundCheck.js'
import {IcRoundKeyboardArrowDown} from '../stories/icons/IcRoundKeyboardArrowDown.js'
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
      ComboBoxPrimitiveProps<T>,
      | 'children'
      | 'validate'
      | 'allowsEmptyCollection'
      | 'inputValue'
      | 'selectedKey'
      | 'className'
      | 'value'
      | 'onSelectionChange'
      | 'onInputChange'
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
  const tagGroupIdentifier = useId()
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  const {contains} = useFilter({sensitivity: 'base'})
  const selectedKeys = selectedItems.items.map(i => i.id)

  const filter = useCallback(
    (item: T, filterText: string) => {
      return !selectedKeys.includes(item.id) && contains(item.name, filterText)
    },
    [contains, selectedKeys]
  )

  const accessibleList = useListData({
    initialItems: items,
    filter
  })

  const [fieldState, setFieldState] = useState<{
    selectedKey: Key | null
    inputValue: string
  }>({
    selectedKey: null,
    inputValue: ''
  })

  const onRemove = useCallback(
    (keys: Set<Key>) => {
      const key = keys.values().next().value
      if (key) {
        selectedItems.remove(key)
        setFieldState({
          inputValue: '',
          selectedKey: null
        })
        onItemCleared?.(key)
      }
    },
    [selectedItems, onItemCleared]
  )

  const onSelectionChange = (id: Key | null) => {
    if (!id) return
    const item = accessibleList.getItem(id)
    if (!item) return
    if (!selectedKeys.includes(id)) {
      selectedItems.append(item)
      setFieldState({
        inputValue: '',
        selectedKey: id
      })
      onItemInserted?.(id)
    }

    accessibleList.setFilterText('')
  }

  const onInputChange = (value: string) => {
    setFieldState(prev => ({
      inputValue: value,
      selectedKey: value === '' ? null : prev.selectedKey
    }))

    accessibleList.setFilterText(value)
  }

  const popLast = useCallback(() => {
    if (selectedItems.items.length === 0) return
    const endKey = selectedItems.items[selectedItems.items.length - 1]
    if (endKey) {
      selectedItems.remove(endKey.id)
      onItemCleared?.(endKey.id)
    }

    setFieldState({
      inputValue: '',
      selectedKey: null
    })
  }, [selectedItems, onItemCleared])

  const onKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && fieldState.inputValue === '') {
        popLast()
      }
    },
    [popLast, fieldState.inputValue]
  )

  useEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.target.clientWidth)
      }
    })

    observer.observe(trigger)
    return () => {
      observer.unobserve(trigger)
    }
  }, [])

  const triggerButtonRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Label {...labelProps(props)} className={styles.MultipleSelect()}>
      <div className={styles.MultipleSelect.container()} ref={triggerRef}>
        <TagGroup
          className={styles.MultipleSelect.tagGroup()}
          aria-label="Selected items"
          id={tagGroupIdentifier}
          onRemove={onRemove}
        >
          <TagList
            items={selectedItems.items}
            className={styles.MultipleSelect.tagGroup.tagList()}
          >
            {props.tag}
          </TagList>
        </TagGroup>
        <ComboBox
          {...props}
          allowsEmptyCollection
          aria-label="Available items"
          items={accessibleList.items}
          selectedKey={fieldState.selectedKey}
          inputValue={fieldState.inputValue}
          onSelectionChange={onSelectionChange}
          onInputChange={onInputChange}
          className={styles.MultipleSelect.comboBox()}
        >
          <div className={styles.MultipleSelect.wrapper()}>
            <Input
              className={styles.MultipleSelect.input()}
              placeholder={props.placeholder}
              onBlur={() => {
                setFieldState({
                  inputValue: '',
                  selectedKey: null
                })
                accessibleList.setFilterText('')
              }}
              onKeyDownCapture={onKeyDownCapture}
            />
            <Button
              type="button"
              ref={triggerButtonRef}
              className={styles.MultipleSelect.trigger()}
            >
              <Icon
                icon={IcRoundKeyboardArrowDown}
                className={styles.MultipleSelect.trigger.icon()}
              />
            </Button>
          </div>
          <Popover
            isNonModal
            style={{width: `${width}px`}}
            triggerRef={triggerRef}
            trigger="ComboBox"
            className={styles.MultipleSelectPopover()}
          >
            <ListBox
              renderEmptyState={() =>
                renderEmptyState ? (
                  renderEmptyState(fieldState.inputValue)
                ) : (
                  <p className={styles.MultipleSelectPopover.empty()}>
                    {fieldState.inputValue ? (
                      <>
                        No results found for:{' '}
                        <strong>{fieldState.inputValue}</strong>
                      </>
                    ) : (
                      'No options'
                    )}
                  </p>
                )
              }
              selectionMode="multiple"
              className={styles.MultipleSelectPopover.listbox()}
            >
              {children}
            </ListBox>
          </Popover>
        </ComboBox>
      </div>
      {name && (
        <input hidden name={name} value={selectedKeys.join(',')} readOnly />
      )}
    </Label>
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
