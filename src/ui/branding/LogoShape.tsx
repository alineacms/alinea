import styler from '@alinea/styler'
import type {HTMLProps} from 'react'
import css from './LogoShape.module.scss'

const styles = styler(css)

export interface LogoShapeProps extends HTMLProps<HTMLDivElement> {
  foreground?: string
  background?: string
}

export function LogoShape({
  children,
  foreground = 'var(--alinea-accent-foreground)',
  background = 'var(--alinea-accent)',
  ...props
}: LogoShapeProps) {
  return (
    <div
      style={{color: foreground}}
      className={styles.root.mergeProps(props)()}
    >
      <svg
        className={styles.root.bg()}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M18 36C25.884 36 29.9427 36 32.8047 33.138C35.6667 30.276 36 25.884 36 18C36 10.116 35.6667 6.05733 32.8047 3.19533C29.9427 0.333333 25.884 0 18 0C10.116 0 6.05733 0.333333 3.19533 3.19533C0.333333 6.05733 0 10.116 0 18C0 25.884 0.333333 29.9427 3.19533 32.8047C6.05733 35.6667 10.116 36 18 36Z"
          fill={background}
        />
      </svg>
      {children}
    </div>
  )
}

/*

<svg width="1em" viewBox="0 0 72 102">
  <path
    stroke="var(--alinea-foreground)"
    fill="none"
    strokeWidth="10"
    d="M6,66C6,32.9,32.9,6,66,6v90c-16.6,0-30-13.4-30-30l0,0c0-16.6,13.4-30,30-30l0,0"
  />
</svg>

*/
