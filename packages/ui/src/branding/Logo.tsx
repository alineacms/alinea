import {PropsWithChildren} from 'react'
import {fromModule} from '../util/Styler'
import css from './Logo.module.scss'

const styles = fromModule(css)

export type LogoShapeProps = PropsWithChildren<{}>

export function Logo({children}: LogoShapeProps) {
  return (
    <div className={styles.root()}>
      <svg
        className={styles.root.bg()}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="grad1"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
            gradientTransform="rotate(65)"
          >
            <stop
              offset="0%"
              style={{stopColor: 'var(--accent)', stopOpacity: 1}}
            />
            <stop
              offset="100%"
              style={{stopColor: 'var(--accent)', stopOpacity: 1}}
            />
          </linearGradient>
        </defs>
        <path
          d="M18 36C25.884 36 29.9427 36 32.8047 33.138C35.6667 30.276 36 25.884 36 18C36 10.116 35.6667 6.05733 32.8047 3.19533C29.9427 0.333333 25.884 0 18 0C10.116 0 6.05733 0.333333 3.19533 3.19533C0.333333 6.05733 0 10.116 0 18C0 25.884 0.333333 29.9427 3.19533 32.8047C6.05733 35.6667 10.116 36 18 36Z"
          fill="url(#grad1)"
        />
      </svg>
      {children}
    </div>
  )
}
