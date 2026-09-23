import {type DOMAttributes, type ReactElement, isValidElement} from 'react'
import {Pressable} from 'react-aria-components'
import {Button, type ButtonProps} from '../Button.js'

export interface TriggerProps extends ButtonProps {}

/**
 * Renders the element that opens an overlay. By default this is a Button,
 * with `asChild` the child is used instead: a DOM element is made pressable,
 * a component (eg. a Button) picks up the trigger behavior itself.
 */
export function Trigger({asChild, children, ...props}: TriggerProps) {
  if (!asChild) return <Button {...props}>{children}</Button>
  if (isValidElement(children) && typeof children.type === 'string')
    return (
      <Pressable>
        {children as ReactElement<DOMAttributes<Element>, string>}
      </Pressable>
    )
  return children
}
