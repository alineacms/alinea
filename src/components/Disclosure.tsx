import styler from '@alinea/styler'
import type {ReactNode} from 'react'
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

export type {DisclosurePanelProps}

export interface DisclosureProps extends DisclosurePrimitiveProps {
  appearance?: 'default' | 'field' | 'block'
}

export function Disclosure({
  appearance = 'default',
  className,
  ...props
}: DisclosureProps) {
  return (
    <DisclosurePrimitive
      {...props}
      data-appearance={appearance}
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

export interface DisclosureHeaderProps extends HeadingProps {
  chevronPosition?: 'start' | 'end'
  summary?: ReactNode
}

export function DisclosureHeader({
  children,
  chevronPosition = 'start',
  className,
  summary,
  ...props
}: DisclosureHeaderProps) {
  const chevron = (
    <Icon
      icon={IcRoundKeyboardArrowRight}
      className={styles.Disclosure.chevron()}
    />
  )
  return (
    <Heading
      {...props}
      className={styles.Disclosure.heading(
        styler.merge({
          className
        })
      )}
    >
      <Button
        slot="trigger"
        className={styles.Disclosure.trigger()}
        data-chevron-position={chevronPosition}
      >
        {chevronPosition === 'start' && chevron}
        <span className={styles.Disclosure.title()}>{children}</span>
        {summary && (
          <span className={styles.Disclosure.summary()}>{summary}</span>
        )}
        {chevronPosition === 'end' && chevron}
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
