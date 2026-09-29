import {isValidElement} from 'react'
import {usePress} from 'react-aria'
import {Pressable} from 'react-aria-components'
import {Button, type ButtonProps} from '../Button.js'
import {Slot, type SlotProps} from './Slot.js'

export interface TriggerProps extends ButtonProps {}

/**
 * Renders the element that opens an overlay. By default this is a Button,
 * with `asChild` the props are merged into the child instead. Our own Button
 * picks up the trigger behavior itself, any other child is made pressable.
 */
export function Trigger({asChild, children, ...props}: TriggerProps) {
  if (!asChild) return <Button {...props}>{children}</Button>
  const slot = <Slot {...(props as SlotProps)}>{children}</Slot>
  if (!isValidElement<ButtonProps>(children)) return null
  if (children.type === Button && !children.props.asChild) return slot
  return (
    // A disabled element cannot be focused, so it is not pressable either
    <Pressable isDisabled={Boolean(children.props.disabled ?? props.disabled)}>
      {slot}
    </Pressable>
  )
}

/**
 * Dialogs and popovers may be opened without a trigger: controlled through
 * `open` or positioned against an anchor. react-aria's trigger warns when no
 * pressable child registers with it, so this registers in place of the
 * trigger. It renders nothing and never receives press events.
 */
export function OptionalTrigger() {
  usePress({})
  return null
}
