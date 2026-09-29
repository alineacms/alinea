import {type DOMAttributes, type ReactElement, isValidElement} from 'react'
import {usePress} from 'react-aria'
import {Pressable} from 'react-aria-components'
import {Button, type ButtonProps} from '../Button.js'

export interface TriggerProps extends ButtonProps {}

interface TriggerElementProps extends DOMAttributes<Element> {
  disabled?: boolean
}

/**
 * Renders the element that opens an overlay. By default this is a Button,
 * with `asChild` the child is used instead: a DOM element is made pressable,
 * a component (eg. a Button) picks up the trigger behavior itself.
 */
export function Trigger({asChild, children, ...props}: TriggerProps) {
  if (!asChild) return <Button {...props}>{children}</Button>
  if (
    isValidElement<TriggerElementProps>(children) &&
    typeof children.type === 'string'
  )
    return (
      // A disabled element cannot be focused, so it is not pressable either
      <Pressable isDisabled={Boolean(children.props.disabled)}>
        {children as ReactElement<TriggerElementProps, string>}
      </Pressable>
    )
  return children
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
