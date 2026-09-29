import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {Label} from './Label'
import css from './SectionHeader.module.scss'

const styles = styler(css)

export interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  label?: ReactNode
  className?: string
}

export function SectionHeader({
  title,
  description,
  label,
  className
}: SectionHeaderProps) {
  return (
    <header className={styles.root(styler.merge({className}))}>
      <div className={styles.root.heading()}>
        <h2 className={styles.root.title()}>{title}</h2>
        {label && <Label className={styles.root.label()}>{label}</Label>}
      </div>
      {description && (
        <p className={styles.root.description()}>{description}</p>
      )}
    </header>
  )
}
