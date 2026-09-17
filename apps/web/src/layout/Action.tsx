import styler from '@alinea/styler'
import {cloneElement, forwardRef, PropsWithChildren, ReactElement} from 'react'
import css from './Action.module.scss'

const styles = styler(css)

interface ActionProps {
  size?: number
}

export const Action = forwardRef(function Action(
  {children, size, ...rest}: PropsWithChildren<ActionProps>,
  ref
) {
  if (Array.isArray(children)) throw new Error(`Action requires a single child`)
  if (!children) return null
  if (typeof children !== 'object') return <>{children}</>
  const element = children as ReactElement
  return cloneElement(element, {
    className: styles.action(styler.merge(element.props)),
    ref,
    style: {
      fontSize: size ? `${size / 16}rem` : undefined
    },
    ...rest
  })
})
