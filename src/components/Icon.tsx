import styler from '@alinea/styler'
import {
  type ComponentType,
  type ReactElement,
  type SVGProps,
  cloneElement,
  isValidElement
} from 'react'
import css from './Icon.module.css'

const styles = styler(css)

export interface IconProps extends SVGProps<SVGSVGElement> {
  icon: ComponentType | ReactElement
  'aria-label'?: string
  'aria-hidden'?: boolean | 'false' | 'true'
}

export function Icon({
  icon: IconView,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}: IconProps) {
  const view = typeof IconView === 'function' ? <IconView /> : IconView
  if (!isValidElement<SVGProps<SVGSVGElement>>(view)) return null
  const className =
    typeof props.className === 'string' ? props.className : undefined
  return cloneElement(view, {
    focusable: 'false',
    'aria-label': ariaLabel,
    'aria-hidden': ariaLabel ? ariaHidden || undefined : true,
    role: 'img',
    className: styles.Icon(styler.merge({className})),
    ...props
  })
}
