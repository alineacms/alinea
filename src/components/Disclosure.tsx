import styler from '@alinea/styler'
import {
  Button,
  Disclosure as DisclosurePrimitive,
  DisclosurePanel as DisclosurePanelPrimitive,
  type DisclosurePanelProps,
  type DisclosureProps as DisclosurePrimitiveProps,
  type HeadingProps,
  Heading
} from 'react-aria-components'
import {IcRoundKeyboardArrowRight} from '../dashboard/icons.js'
import {Icon} from './Icon.js'
import css from './Disclosure.module.css'

const styles = styler(css)

export type {DisclosurePanelProps, DisclosurePrimitiveProps as DisclosureProps}

export function Disclosure({className, ...props}: DisclosurePrimitiveProps) {
  return (
    <DisclosurePrimitive
      {...props}
      className={renderProps =>
        styles.Disclosure(
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

export function DisclosureHeader({
  children,
  className,
  ...props
}: HeadingProps) {
  return (
    <Heading
      {...props}
      className={styles.Disclosure.heading(
        styler.merge({
          className
        })
      )}
    >
      <Button slot="trigger" className={styles.Disclosure.trigger()}>
        <Icon
          icon={IcRoundKeyboardArrowRight}
          className={styles.Disclosure.chevron()}
        />
        <span className={styles.Disclosure.title()}>{children}</span>
      </Button>
    </Heading>
  )
}

export function DisclosurePanel({
  children,
  className,
  ...props
}: DisclosurePanelProps) {
  return (
    <DisclosurePanelPrimitive
      {...props}
      className={renderProps =>
        styles.Disclosure.panel(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    >
      <div className={styles.Disclosure.panel.content()}>{children}</div>
    </DisclosurePanelPrimitive>
  )
}
