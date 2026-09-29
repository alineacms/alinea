import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import css from './Code.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface CodeProps extends StyleProps, AriaProps, DataProps {
  variant?: 'soft' | 'outline' | 'ghost'
  size?: 'sm' | 'default'
  /** Render a multi-line block (`pre`) instead of inline code */
  block?: boolean
  children: ReactNode
}

export function Code({
  variant = 'soft',
  size = 'default',
  block,
  className,
  children,
  ...props
}: CodeProps) {
  const code = (
    <code
      data-slot="code"
      {...(block ? {} : props)}
      data-variant={variant}
      data-size={size}
      className={styles.Code(
        styler.merge({className: block ? undefined : className})
      )}
    >
      {children}
    </code>
  )
  if (!block) return code
  return (
    <pre
      data-slot="code-block"
      {...props}
      className={styles.CodeBlock(styler.merge({className}))}
    >
      {code}
    </pre>
  )
}
