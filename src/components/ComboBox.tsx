import styler from '@alinea/styler'
import {
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef
} from 'react'
import {
  Button,
  ComboBox as ComboBoxPrimitive,
  ComboBoxStateContext,
  Input,
  ListBox
} from 'react-aria-components'
import {IcRoundClose, IcRoundKeyboardArrowDown} from '#/dashboard/icons.js'
import css from './ComboBox.module.css'
import {Field} from './Field.js'
import {Icon} from './Icon.js'
import {ListBoxGroup} from './internal/ListBoxGroup.js'
import {ListBoxOption} from './internal/ListBoxOption.js'
import {PopoverSurface} from './internal/PopoverSurface.js'
import {Spinner} from './Spinner.js'
import type {
  AriaProps,
  DataProps,
  FieldSharedProps,
  IconType,
  Key,
  OpenStateProps,
  StyleProps
} from './types.js'

const styles = styler(css)

function showAll() {
  return true
}

export interface ComboBoxProps<V extends Key = Key>
  extends FieldSharedProps, OpenStateProps, StyleProps, AriaProps, DataProps {
  /** The value of the selected ComboBoxItem */
  value?: V | null
  defaultValue?: V | null
  /** Called with the selected value, or null when the selection is cleared */
  onValueChange?: (value: V | null) => void
  inputValue?: string
  defaultInputValue?: string
  onInputValueChange?: (value: string) => void
  placeholder?: string
  /** Keep text that does not match an item instead of reverting it on blur */
  allowsCustomValue?: boolean
  /** Shown in the list when no item matches, the list stays closed if unset */
  emptyMessage?: ReactNode
  /**
   * Whether an item is shown for the typed text, defaults to a case and
   * accent insensitive match anywhere in its text. Pass false to show every
   * item, eg. when the server already filtered them.
   */
  filter?: false | ((textValue: string, inputValue: string) => boolean)
  /** Shows a spinner, eg. while the items for the typed text load */
  loading?: boolean
  /** Name of the hidden form input carrying the value */
  name?: string
  autoFocus?: boolean
  /** ComboBoxItem and ComboBoxGroup elements */
  children: ReactNode
}

/** A labelled text input that filters a list of options to pick from */
export function ComboBox<V extends Key = Key>({
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
  filter,
  loading,
  autoFocus,
  className,
  style,
  children,
  ...props
}: ComboBoxProps<V>) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)
  return (
    <ComboBoxPrimitive
      data-slot="combobox"
      {...props}
      className={styles.ComboBox(styler.merge({className}))}
      style={style}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={key => onValueChange?.(key as V | null)}
      inputValue={inputValue}
      defaultInputValue={defaultInputValue}
      onInputChange={onInputValueChange}
      onOpenChange={isOpen => {
        if (!syncing.current) onOpenChange?.(isOpen)
      }}
      isDisabled={disabled}
      isReadOnly={readOnly}
      isRequired={required}
      isInvalid={error ? true : undefined}
      allowsEmptyCollection={emptyMessage !== undefined}
      defaultFilter={filter === false ? showAll : filter}
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
        <ComboBoxOpenState
          open={open}
          defaultOpen={defaultOpen}
          syncing={syncing}
        />
        <ComboBoxTrigger
          triggerRef={triggerRef}
          placeholder={placeholder}
          autoFocus={autoFocus}
          invalid={Boolean(error)}
          clearable={!disabled && !readOnly}
          loading={loading}
        />
        <PopoverSurface
          data-slot="combobox-content"
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
                {loading ? <Spinner size="sm" /> : emptyMessage}
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
  /** Set while syncing, so the change is not reported back to the parent */
  syncing: MutableRefObject<boolean>
}

/** React-aria's ComboBox has no controlled open state, sync it here */
function ComboBoxOpenState({
  open,
  defaultOpen,
  syncing
}: ComboBoxOpenStateProps) {
  const state = useContext(ComboBoxStateContext)
  const isOpen = Boolean(state?.isOpen)
  function sync(open: boolean) {
    syncing.current = true
    if (open) state?.open(null, 'manual')
    else state?.close()
    syncing.current = false
  }
  // The open state lives inside react-aria, so it can only be synced from an
  // effect, a layout effect so it is not painted in the wrong state first
  useLayoutEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (defaultOpen) sync(true)
    // Only on mount
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (open !== undefined && open !== isOpen) sync(open)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isOpen])
  return null
}

interface ComboBoxTriggerProps {
  triggerRef: RefObject<HTMLDivElement>
  placeholder?: string
  autoFocus?: boolean
  invalid: boolean
  clearable: boolean
  loading?: boolean
}

function ComboBoxTrigger({
  triggerRef,
  placeholder,
  autoFocus,
  invalid,
  clearable,
  loading
}: ComboBoxTriggerProps) {
  const state = useContext(ComboBoxStateContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasClear = clearable && Boolean(state?.inputValue)
  return (
    <div
      ref={triggerRef}
      data-slot="combobox-trigger"
      data-invalid={invalid || undefined}
      className={styles.ComboBoxTrigger()}
    >
      <Input
        ref={inputRef}
        data-slot="combobox-input"
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={styles.ComboBoxTrigger.input()}
      />
      {loading && (
        <Spinner
          size="sm"
          data-slot="combobox-spinner"
          className={styles.ComboBoxTrigger.spinner()}
        />
      )}
      {hasClear && (
        <Button
          slot={null}
          aria-label="Clear"
          data-slot="combobox-clear"
          onPress={() => {
            state?.setInputValue('')
            state?.setSelectedKey(null)
            // The clear button unmounts, keep focus in the field
            inputRef.current?.focus()
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
          data-slot="combobox-icon"
          className={styles.ComboBoxTrigger.arrow()}
        />
      </Button>
    </div>
  )
}

export interface ComboBoxItemProps extends StyleProps {
  value: Key
  /** Text used for filtering and the input, defaults to string children */
  textValue?: string
  disabled?: boolean
  /** Icon shown before the label in the list */
  icon?: IconType | ReactElement
  /** Secondary text shown below the label in the list */
  description?: ReactNode
  children: ReactNode
}

export function ComboBoxItem(props: ComboBoxItemProps) {
  return <ListBoxOption slot="combobox-item" {...props} />
}

export interface ComboBoxGroupProps extends AriaProps {
  label?: ReactNode
  children: ReactNode
}

export function ComboBoxGroup(props: ComboBoxGroupProps) {
  return (
    <ListBoxGroup
      slot="combobox-group"
      labelSlot="combobox-group-label"
      {...props}
    />
  )
}
