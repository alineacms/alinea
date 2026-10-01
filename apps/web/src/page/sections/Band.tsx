import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {Section} from '@/layout/Section'
import css from './Band.module.scss'

const styles = styler(css)

export interface BandProps {
  children: ReactNode
}

/** A section on a full-bleed tinted band, used once or twice per long page */
export function Band({children}: BandProps) {
  return (
    <div className={styles.root()}>
      <Section flush>{children}</Section>
    </div>
  )
}
