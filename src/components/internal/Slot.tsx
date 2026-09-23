import {
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  cloneElement,
  isValidElement
} from 'react'
import {mergeProps} from 'react-aria'

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>
  children?: ReactNode
}

/** Renders its single child element with the slot props merged in. */
export function Slot({children, ref, ...props}: SlotProps) {
  if (!isValidElement<SlotProps>(children)) return null
  const childRef = children.props.ref
  return cloneElement(children, {
    ...mergeProps(props, children.props),
    ref: ref && childRef ? mergeRefs(ref, childRef) : (ref ?? childRef)
  })
}

function mergeRefs<T>(...refs: Array<Ref<T>>): Ref<T> {
  return value => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value)
      else if (ref) (ref as {current: T | null}).current = value
    }
  }
}
