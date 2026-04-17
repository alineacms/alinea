import styler from '@alinea/styler'
import {type ReactNode, useContext} from 'react'
import type {
  ListBoxItemProps,
  SelectProps as SelectPrimitiveProps
} from 'react-aria-components'
import {
  Button,
  ListBox,
  ListBoxItem,
  Select as SelectPrimitive,
  SelectStateContext,
  SelectValue
} from 'react-aria-components'
import {IcRoundCheck} from '../stories/icons/IcRoundCheck.tsx'
import {IcRoundClose} from '../stories/icons/IcRoundClose.tsx'
import {IcRoundKeyboardArrowDown} from '../stories/icons/IcRoundKeyboardArrowDown.tsx'
import {Label, type LabelSharedProps, labelProps} from './Label.tsx'
import {Popover} from './Popover.tsx'
import css from './Select.module.css'

const styles = styler(css)

export interface SelectProps<T extends object>
  extends Omit<SelectPrimitiveProps<T>, 'children'>,
    LabelSharedProps {
  items?: Iterable<T>
  children: React.ReactNode | ((item: T) => React.ReactNode)
}

export function Select<T extends object>({
  className,
  ...props
}: SelectProps<T>) {
  const content = (
    <>
      <SelectTrigger {...props} />
      <SelectPopover {...props} />
    </>
  )

  return (
    <SelectPrimitive
      {...props}
      className={renderProps =>
        styles.Select(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      {props.label ? <Label {...labelProps(props)}>{content}</Label> : content}
    </SelectPrimitive>
  )
}

function SelectTrigger<T extends object>({
  children,
  items,
  ...props
}: SelectProps<T>) {
  const state = useContext(SelectStateContext)
  const hasClear = Boolean(!props.isRequired && state?.selectedKey)
  return (
    <div className={styles.SelectTrigger()}>
      <Button
        className={styles.SelectTrigger.button()}
        data-expanded={props.isOpen}
        data-clear={hasClear || undefined}
      >
        <SelectValue className={styles.SelectTrigger.button.value()} />
        <IcRoundKeyboardArrowDown className={styles.SelectTrigger.button.arrow()} />
      </Button>
      {!props.isRequired && <SelectClear />}
    </div>
  )
}

function SelectPopover<T extends object>(props: SelectProps<T>) {
  const state = useContext(SelectStateContext)
  const hasClear = Boolean(!props.isRequired && state?.selectedKey)
  return (
    <Popover
      className={styles.SelectPopover()}
      data-clear={hasClear || undefined}
    >
      <ListBox items={props.items} className={styles.SelectPopover.listbox()}>
        {props.children}
      </ListBox>
    </Popover>
  )
}

function SelectClear() {
  const state = useContext(SelectStateContext)
  if (!state?.selectedKey) return null
  return (
    <Button
      slot={null}
      onPress={() => state?.setSelectedKey(null)}
      className={styles.SelectClear()}
    >
      <IcRoundClose />
    </Button>
  )
}

interface SelectItemProps extends ListBoxItemProps {
  children: ReactNode
}

export function SelectItem({children, ...props}: SelectItemProps) {
  const textValue =
    props.textValue || (typeof children === 'string' ? children : undefined)
  if (!textValue)
    throw new Error(
      'You must provide a textValue property or a string child to SelectItem'
    )

  return (
    <ListBoxItem
      className={styles.SelectItem()}
      textValue={textValue}
      {...props}
    >
      {({isSelected}) => {
        return (
          <>
            {isSelected && <IcRoundCheck className={styles.SelectItem.check()} />}
            {children}
          </>
        )
      }}
    </ListBoxItem>
  )
}
