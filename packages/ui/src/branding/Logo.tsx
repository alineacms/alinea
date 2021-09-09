import React from 'react'
import {PropsWithChildren} from 'react'
import {css} from '@stitches/react'

export type LogoShapeProps = PropsWithChildren<{}>

const styles = {
  root: css({
    position: 'relative',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '0',
    fontWeight: 'bold',
    color: '#14151a',
    fontSize: '14px'
  }),
  bg: css({
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '-1'
  })
}

export function Logo({children}: LogoShapeProps) {
  return (
    <div className={styles.root()}>
      <svg
        className={styles.bg()}
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
            <stop offset="0%" style={{stopColor: '#FFBD67', stopOpacity: 1}} />
            <stop
              offset="100%"
              style={{stopColor: '#FFBD67', stopOpacity: 1}}
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
