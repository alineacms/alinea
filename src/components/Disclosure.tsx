import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {
  Button,
  Disclosure as DisclosurePrimitive,
  DisclosurePanel as DisclosurePanelPrimitive,
  type DisclosurePanelProps,
  type DisclosureProps as DisclosurePrimitiveProps,
  Heading
} from 'react-aria-components'
import {IcRoundKeyboardArrowRight} from '../dashboard/icons.js'
import {Icon} from './Icon.js'
import css from './Disclosure.module.css'

const styles = styler(css)

export type {DisclosurePanelProps} from 'react-aria-components'

export interface DisclosureProps
  extends Omit<DisclosurePrimitiveProps, 'children'> {
  title: ReactNode
  children?: ReactNode
}

export function Disclosure({
  title,
  children,
  className,
  ...props
}: DisclosureProps) {
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
    >
      <Heading className={styles.Disclosure.heading()}>
        <Button slot="trigger" className={styles.Disclosure.trigger()}>
          <Icon
            icon={IcRoundKeyboardArrowRight}
            className={styles.Disclosure.chevron()}
          />
          <span className={styles.Disclosure.title()}>{title}</span>
        </Button>
      </Heading>
      <DisclosurePanel>{children}</DisclosurePanel>
    </DisclosurePrimitive>
  )
}

export function DisclosurePanel({
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
    />
  )
}
