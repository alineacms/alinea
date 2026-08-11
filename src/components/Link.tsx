import styler from '@alinea/styler'
import {
  Link as RACLink,
  type LinkProps as RACLinkProps
} from 'react-aria-components'
import css from './Link.module.css'

const styles = styler(css)

export interface LinkProps extends RACLinkProps {
  variant?: 'plain' | 'underline' | 'inherit'
}

export function Link({variant, ...props}: LinkProps) {
  const {className, ...rest} = props
  return (
    <RACLink
      data-variant={variant}
      {...rest}
      className={renderProps =>
        styles.Link(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}
