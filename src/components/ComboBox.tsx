import styler from '@alinea/styler'
import {
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef
} from 'react'
import {
  Button,
  ComboBox as ComboBoxPrimitive,
  ComboBoxStateContext,
  Input,
  ListBox
} from 'react-aria-components'
import {IcRoundClose, IcRoundKeyboardArrowDown} from '../dashboard/icons.js'
import css from './ComboBox.module.css'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {ListBoxOption} from './internal/ListBoxOption.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  OpenStateProps,
  StyleProps
} from './types.js'

const styles = styler(css)

export interface ComboBoxProps
  extends FieldSharedProps, OpenStateProps, StyleProps, AriaProps, DataProps {
  value?: string | null
  defaultValue?: string | null
  /** Called with the selected value, or null when the selection is cleared */
  onValueChange?: (value: string | null) => void
  inputValue?: string
  defaultInputValue?: string
  onInputValueChange?: (value: string) => void
  placeholder?: string
  /** Keep text that does not match an item instead of reverting it on blur */
  allowsCustomValue?: boolean
  /** Shown in the list when no item matches, the list stays closed if unset */
  emptyMessage?: ReactNode
  /** Name of the hidden form input carrying the value */
  name?: string
  autoFocus?: boolean
  /** ComboBoxItem elements */
  children: ReactNode
}

/** A labelled text input that filters a list of options to pick from */
export function ComboBox({
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
  inputValue,
  defaultInputValue,
  onInputValueChange,
  open,
  defaultOpen,
  onOpenChange,
  placeholder,
  emptyMessage,
  autoFocus,
  className,
  style,
  children,
  ...props
}: ComboBoxProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  return (
    <ComboBoxPrimitive
      data-slot="combobox"
      {...props}
      className={styles.ComboBox(styler.merge({className}))}
      style={style}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={key =>
        onValueChange?.(key === null ? null : String(key))
      }
      inputValue={inputValue}
      defaultInputValue={defaultInputValue}
      onInputChange={onInputValueChange}
      onOpenChange={isOpen => onOpenChange?.(isOpen)}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isRequired={required}
      isInvalid={error ? true : undefined}
      allowsEmptyCollection={emptyMessage !== undefined}
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
        <ComboBoxOpenState open={open} defaultOpen={defaultOpen} />
        <ComboBoxTrigger
          triggerRef={triggerRef}
          placeholder={placeholder}
          autoFocus={autoFocus}
          invalid={Boolean(error)}
          clearable={!disabled && !readOnly}
        />
        <PopoverSurface
          data-slot="combobox-content"
          className={styles.ComboBoxContent()}
          triggerRef={triggerRef}
          matchTriggerWidth
        >
          <ListBox
            className={styles.ComboBoxContent.list()}
            renderEmptyState={() => (
              <div
                data-slot="combobox-empty"
                className={styles.ComboBoxContent.empty()}
              >
                {emptyMessage}
              </div>
            )}
          >
            {children}
          </ListBox>
        </PopoverSurface>
      </Field>
    </ComboBoxPrimitive>
  )
}

interface ComboBoxOpenStateProps {
  open?: boolean
  defaultOpen?: boolean
}

/** React-aria's ComboBox has no controlled open state, sync it here */
function ComboBoxOpenState({open, defaultOpen}: ComboBoxOpenStateProps) {
  const state = useContext(ComboBoxStateContext)
  const isOpen = Boolean(state?.isOpen)
  // The open state lives inside react-aria, so it can only be synced from an
  // effect rather than set from an event handler
  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (defaultOpen) state?.open(null, 'manual')
    // Only on mount
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (open === undefined || !state || open === isOpen) return
    if (open) state.open(null, 'manual')
    else state.close()
  }, [open, isOpen, state])
  return null
}

interface ComboBoxTriggerProps {
  triggerRef: RefObject<HTMLDivElement>
  placeholder?: string
  autoFocus?: boolean
  invalid: boolean
  clearable: boolean
}

function ComboBoxTrigger({
  triggerRef,
  placeholder,
  autoFocus,
  invalid,
  clearable
}: ComboBoxTriggerProps) {
  const state = useContext(ComboBoxStateContext)
  const hasClear = clearable && Boolean(state?.inputValue)
  return (
    <div
      ref={triggerRef}
      data-slot="combobox-trigger"
      data-invalid={invalid || undefined}
      className={styles.ComboBoxTrigger()}
    >
      <Input
        data-slot="combobox-input"
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={styles.ComboBoxTrigger.input()}
      />
      {hasClear && (
        <Button
          slot={null}
          aria-label="Clear"
          data-slot="combobox-clear"
          onPress={() => {
            state?.setInputValue('')
            state?.setSelectedKey(null)
          }}
          className={styles.ComboBoxTrigger.action()}
        >
          <Icon icon={IcRoundClose} />
        </Button>
      )}
      <Button
        data-slot="combobox-button"
        className={styles.ComboBoxTrigger.action()}
      >
        <Icon
          icon={IcRoundKeyboardArrowDown}
          className={styles.ComboBoxTrigger.arrow()}
        />
      </Button>
    </div>
  )
}

export interface ComboBoxItemProps extends StyleProps {
  value: string
  /** Text used for filtering and the input, defaults to string children */
  textValue?: string
  disabled?: boolean
  children: ReactNode
}

export function ComboBoxItem(props: ComboBoxItemProps) {
  return <ListBoxOption slot="combobox-item" {...props} />
}
