import styler from '@alinea/styler'
import {
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useRef
} from 'react'
import {
  Button,
  Header,
  ListBox,
  ListBoxSection,
  Select as SelectPrimitive,
  SelectStateContext,
  SelectValue,
  Separator
} from 'react-aria-components'
import {IcRoundClose, IcRoundKeyboardArrowDown} from '../dashboard/icons.js'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {ListBoxOption} from './internal/ListBoxOption.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import css from './Select.module.css'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  IconType,
  OpenStateProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface SelectProps
  extends FieldSharedProps, OpenStateProps, StyleProps, AriaProps, DataProps {
  value?: string | null
  defaultValue?: string | null
  /** Called with the selected value, or null when the value is cleared */
  onValueChange?: (value: string | null) => void
  placeholder?: string
  /** Name of the hidden form input carrying the value */
  name?: string
  autoFocus?: boolean
  /** SelectItem, SelectGroup and SelectSeparator elements */
  children: ReactNode
}

/**
 * A labelled field to pick a single value from a list. The value can be
 * cleared unless the field is required.
 */
export function Select({
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
  className,
  style,
  children,
  ...props
}: SelectProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  return (
    <SelectPrimitive
      data-slot="select"
      {...props}
      className={styles.Select(styler.merge({className}))}
      style={style}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={key =>
        onValueChange?.(key === null ? null : String(key))
      }
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      isDisabled={disabled || readOnly}
      isRequired={required}
      isInvalid={error ? true : undefined}
      placeholder={placeholder}
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
        <SelectTrigger
          triggerRef={triggerRef}
          clearable={!required && !disabled && !readOnly}
          invalid={Boolean(error)}
          readOnly={readOnly}
        />
        <PopoverSurface
          data-slot="select-content"
          className={styles.SelectContent()}
          triggerRef={triggerRef}
        >
          <ListBox className={styles.SelectContent.list()}>{children}</ListBox>
        </PopoverSurface>
      </Field>
    </SelectPrimitive>
  )
}

interface SelectTriggerProps {
  triggerRef: RefObject<HTMLDivElement>
  clearable: boolean
  invalid: boolean
  readOnly?: boolean
}

function SelectTrigger({
  triggerRef,
  clearable,
  invalid,
  readOnly
}: SelectTriggerProps) {
  const state = useContext(SelectStateContext)
  const hasValue = Boolean(state && state.selectedItems.length > 0)
  return (
    <div
      ref={triggerRef}
      data-slot="select-trigger"
      data-invalid={invalid || undefined}
      data-readonly={readOnly || undefined}
      className={styles.SelectTrigger()}
    >
      <Button className={styles.SelectTrigger.button()}>
        <SelectValue
          data-slot="select-value"
          className={styles.SelectTrigger.value()}
        >
          {({isPlaceholder, defaultChildren}) =>
            isPlaceholder ? (
              <span className={styles.SelectTrigger.placeholder()}>
                {defaultChildren}
              </span>
            ) : (
              defaultChildren
            )
          }
        </SelectValue>
        <Icon
          icon={IcRoundKeyboardArrowDown}
          data-slot="select-icon"
          className={styles.SelectTrigger.arrow()}
        />
      </Button>
      {clearable && hasValue && (
        <Button
          slot={null}
          aria-label="Clear"
          data-slot="select-clear"
          onPress={() => state?.setValue(null)}
          className={styles.SelectTrigger.clear()}
        >
          <Icon icon={IcRoundClose} />
        </Button>
      )}
    </div>
  )
}

export interface SelectItemProps extends StyleProps {
  value: string
  disabled?: boolean
  icon?: IconType | ReactElement
  /** Text used for typeahead and the value, defaults to string children */
  textValue?: string
  /** Secondary text shown below the label in the list */
  description?: ReactNode
  children: ReactNode
}

export function SelectItem(props: SelectItemProps) {
  return <ListBoxOption slot="select-item" {...props} />
}

export interface SelectGroupProps extends AriaProps {
  label?: ReactNode
  children: ReactNode
}

export function SelectGroup({label, children, ...props}: SelectGroupProps) {
  return (
    <ListBoxSection
      data-slot="select-group"
      {...props}
      className={styles.SelectGroup()}
    >
      {label && (
        <Header data-slot="select-label" className={styles.SelectLabel()}>
          {label}
        </Header>
      )}
      {children}
    </ListBoxSection>
  )
}

export function SelectSeparator() {
  return (
    <Separator
      data-slot="select-separator"
      className={styles.SelectSeparator()}
    />
  )
}
