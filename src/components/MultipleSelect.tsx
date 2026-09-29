import styler from '@alinea/styler'
import {type MouseEvent, type ReactNode, useRef, useState} from 'react'
import {
  Autocomplete,
  Button,
  Group,
  Input,
  ListBox,
  SearchField as SearchFieldPrimitive,
  Select as SelectPrimitive,
  SelectValue,
  Tag,
  TagGroup,
  TagList,
  useFilter
} from 'react-aria-components'
import {
  IcRoundClose,
  IcRoundKeyboardArrowDown,
  IcRoundSearch
} from '#/dashboard/icons.js'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {ListBoxOption} from './internal/ListBoxOption.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import css from './MultipleSelect.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  OpenStateProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface MultipleSelectProps
  extends FieldSharedProps, OpenStateProps, StyleProps, AriaProps, DataProps {
  value?: Array<string>
  defaultValue?: Array<string>
  onValueChange?: (value: Array<string>) => void
  placeholder?: string
  /** Shown in the list when no item matches the search, defaults to "No options" */
  emptyMessage?: ReactNode
  /** Name of the hidden form input carrying the values */
  name?: string
  /** MultipleSelectItem elements */
  children: ReactNode
}

/**
 * A labelled field to pick several values from a searchable list, the
 * selected values are shown as removable tags.
 */
export function MultipleSelect({
  label,
  description,
  error,
  required,
  disabled,
  readOnly,
  icon,
  shared,
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen,
  onOpenChange,
  placeholder,
  emptyMessage = 'No options',
  className,
  style,
  children,
  ...props
}: MultipleSelectProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isOpen, setOpen] = useState(defaultOpen ?? false)
  const {contains} = useFilter({sensitivity: 'base'})
  const locked = disabled || readOnly

  function onFieldClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('button, [role="row"]')) return
    triggerButtonRef.current?.click()
  }

  return (
    <SelectPrimitive
      data-slot="multiple-select"
      aria-label={label ? undefined : 'Available items'}
      {...props}
      className={styles.MultipleSelect(styler.merge({className}))}
      style={style}
      selectionMode="multiple"
      value={value}
      defaultValue={defaultValue}
      onChange={keys => onValueChange?.(keys.map(String))}
      // A read only select can be focused but not opened
      isOpen={!readOnly && (open ?? isOpen)}
      onOpenChange={next => {
        if (readOnly) return
        setOpen(next)
        onOpenChange?.(next)
      }}
      isDisabled={disabled}
      isRequired={required}
      isInvalid={error ? true : undefined}
    >
      <Field
        label={label}
        description={description}
        error={error}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        icon={icon}
        shared={shared}
      >
        <Group
          ref={triggerRef}
          data-slot="multiple-select-trigger"
          data-invalid={error ? true : undefined}
          data-readonly={readOnly || undefined}
          className={styles.MultipleSelectTrigger()}
          onClick={onFieldClick}
        >
          <SelectValue className={styles.MultipleSelectTrigger.value()}>
            {({state}) => (
              <TagGroup
                aria-label="Selected items"
                data-slot="multiple-select-value"
                className={styles.MultipleSelectTrigger.tags()}
                onRemove={
                  locked
                    ? undefined
                    : keys => {
                        const current = state.selectedItems.map(
                          item => item.key
                        )
                        state.setValue(current.filter(key => !keys.has(key)))
                      }
                }
              >
                <TagList
                  className={styles.MultipleSelectTrigger.tags.list()}
                  items={state.selectedItems}
                  renderEmptyState={() => (
                    <span
                      data-slot="multiple-select-placeholder"
                      className={styles.MultipleSelectTrigger.placeholder()}
                    >
                      {placeholder}
                    </span>
                  )}
                >
                  {item => (
                    <Tag
                      id={item.key}
                      textValue={item.textValue}
                      data-slot="multiple-select-tag"
                      className={styles.MultipleSelectTag()}
                    >
                      {item.textValue}
                      {!locked && (
                        <Button
                          slot="remove"
                          data-slot="multiple-select-tag-remove"
                          className={styles.MultipleSelectTag.remove()}
                        >
                          <Icon icon={IcRoundClose} />
                        </Button>
                      )}
                    </Tag>
                  )}
                </TagList>
              </TagGroup>
            )}
          </SelectValue>
          <Button
            ref={triggerButtonRef}
            className={styles.MultipleSelectTrigger.button()}
            render={
              readOnly
                ? // react-aria does not pass aria-readonly on to the element
                  props => <button {...props} aria-readonly />
                : undefined
            }
          >
            <Icon
              icon={IcRoundKeyboardArrowDown}
              data-slot="multiple-select-icon"
              className={styles.MultipleSelectTrigger.arrow()}
            />
          </Button>
        </Group>
        <PopoverSurface
          data-slot="multiple-select-content"
          className={styles.MultipleSelectContent()}
          triggerRef={triggerRef}
          matchTriggerWidth
        >
          <Autocomplete filter={contains}>
            <SearchFieldPrimitive
              aria-label="Search options"
              autoFocus
              data-slot="multiple-select-search"
              className={styles.MultipleSelectSearch()}
            >
              <Icon
                icon={IcRoundSearch}
                className={styles.MultipleSelectSearch.icon()}
              />
              <Input
                placeholder="Search"
                className={styles.MultipleSelectSearch.input()}
              />
              <Button
                aria-label="Clear search"
                className={styles.MultipleSelectSearch.clear()}
              >
                <Icon icon={IcRoundClose} />
              </Button>
            </SearchFieldPrimitive>
            <ListBox
              className={styles.MultipleSelectContent.list()}
              renderEmptyState={() => (
                <div
                  data-slot="multiple-select-empty"
                  className={styles.MultipleSelectContent.empty()}
                >
                  {emptyMessage}
                </div>
              )}
            >
              {children}
            </ListBox>
          </Autocomplete>
        </PopoverSurface>
      </Field>
    </SelectPrimitive>
  )
}

export interface MultipleSelectItemProps extends StyleProps {
  value: string
  /** Text used for searching and the tag, defaults to string children */
  textValue?: string
  disabled?: boolean
  children: ReactNode
}

export function MultipleSelectItem(props: MultipleSelectItemProps) {
  return <ListBoxOption slot="multiple-select-item" {...props} />
}
