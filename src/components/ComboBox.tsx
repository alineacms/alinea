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
import {IcRoundCheck} from '../stories/icons/IcRoundCheck.tsx'
import {IcRoundClose} from '../stories/icons/IcRoundClose.tsx'
import {IcRoundKeyboardArrowDown} from '../stories/icons/IcRoundKeyboardArrowDown.tsx'
import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import {Popover} from './Popover.tsx'
import css from './ComboBox.module.css'

const styles = styler(css)

export interface ComboBoxProps<T extends object>
  extends Omit<ComboBoxPrimitiveProps<T>, 'children'>,
    LabelSharedProps {
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
      <Button className={styles.ComboBoxTrigger.button()}>
        <IcRoundKeyboardArrowDown className={styles.ComboBoxTrigger.button.arrow()} />
      </Button>
      {hasClear && <ComboBoxClear />}
    </div>
  )
}

function ComboBoxPopover<T extends object>(props: ComboBoxProps<T>) {
  const state = useContext(ComboBoxStateContext)
  const hasClear = Boolean(state?.inputValue)

  return (
    <Popover
      className={styles.ComboBoxPopover()}
      data-clear={hasClear || undefined}
    >
      <ListBox
        items={props.items}
        className={styles.ComboBoxPopover.listbox()}
      >
        {props.children}
      </ListBox>
    </Popover>
  )
}

function ComboBoxClear() {
  const state = useContext(ComboBoxStateContext)
  if (!state?.inputValue) return null
  return (
    <Button
      slot={null}
      onPress={() => state?.setInputValue('')}
      className={styles.ComboBoxClear()}
    >
      <IcRoundClose />
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
          {isSelected && <IcRoundCheck className={styles.ComboBoxItem.check()} />}
        </>
      )}
    </ListBoxItem>
  )
}
