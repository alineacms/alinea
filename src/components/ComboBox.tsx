import styler from '@alinea/styler'
import {type ReactNode, useContext} from 'react'
import type {
  ComboBoxProps as ComboBoxPrimitiveProps,
  ListBoxItemProps
} from 'react-aria-components'
import {
  Button,
  ComboBox as ComboBoxPrimitive,
  ComboBoxStateContext,
  Input,
  ListBox,
  ListBoxItem
} from 'react-aria-components'
import {
  IcRoundCheck,
  IcRoundClose,
  IcRoundKeyboardArrowDown
} from '../dashboard/icons.js'
import css from './ComboBox.module.css'
import {Label, type LabelSharedProps, labelProps} from './Label.js'
import {Popover} from './Popover.js'
import {Icon} from './Icon.js'

const styles = styler(css)

export interface ComboBoxProps<T extends object>
  extends Omit<ComboBoxPrimitiveProps<T>, 'children'>, LabelSharedProps {
  items?: Iterable<T>
  children: React.ReactNode | ((item: T) => React.ReactNode)
}

export function ComboBox<T extends object>({
  className,
  ...props
}: ComboBoxProps<T>) {
  return (
    <ComboBoxPrimitive
      {...props}
      className={renderProps =>
        styles.ComboBox(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <Label {...labelProps(props)}>
        <ComboBoxTrigger {...props} />
        <ComboBoxPopover {...props} />
      </Label>
    </ComboBoxPrimitive>
  )
}

function ComboBoxTrigger<T extends object>({
  children,
  items,
  ...props
}: ComboBoxProps<T>) {
  const state = useContext(ComboBoxStateContext)
  const hasClear = Boolean(state?.inputValue)

  return (
    <div className={styles.ComboBoxTrigger()}>
      <Input className={styles.ComboBoxTrigger.input()} />
      <div className={styles.ComboBoxTrigger.actions()}>
        <Button className={styles.ComboBoxTrigger.button()}>
          <Icon
            icon={IcRoundKeyboardArrowDown}
            className={styles.ComboBoxTrigger.button.arrow()}
          />
        </Button>
        {hasClear && <ComboBoxClear onClear={() => props.onChange?.(null)} />}
      </div>
    </div>
  )
}

function ComboBoxPopover<T extends object>(props: ComboBoxProps<T>) {
  const state = useContext(ComboBoxStateContext)
  const hasClear = Boolean(state?.inputValue)

  return (
    <Popover data-clear={hasClear || undefined}>
      <ListBox selectionMode={props.selectionMode}>{props.children}</ListBox>
    </Popover>
  )
}

function ComboBoxClear({onClear}: {onClear: () => void}) {
  const state = useContext(ComboBoxStateContext)
  if (!state?.inputValue) return null
  return (
    <Button
      slot={null}
      onPress={() => {
        onClear()
        state?.setInputValue('')
      }}
      className={styles.ComboBoxClear()}
    >
      <IcRoundClose className={styles.ComboBoxClear.icon()} />
    </Button>
  )
}

interface ComboBoxItemProps extends ListBoxItemProps {
  children: ReactNode
}

export function ComboBoxItem({children, ...props}: ComboBoxItemProps) {
  return (
    <ListBoxItem
      className={styles.ComboBoxItem()}
      textValue={typeof children === 'string' ? children : props.textValue}
      {...props}
    >
      {({isSelected}) => (
        <>
          {children}
          {isSelected && (
            <IcRoundCheck className={styles.ComboBoxItem.check()} />
          )}
        </>
      )}
    </ListBoxItem>
  )
}
