import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import {DemoButton} from './DemoButton'
import css from './DemoSectionHeader.module.scss'

const styles = styler(css)

export interface DemoSectionHeaderProps {
  title: ReactNode
  text?: ReactNode
  link?: {href: string; label: string} | null
}

export function DemoSectionHeader({title, text, link}: DemoSectionHeaderProps) {
  return (
    <header className={styles.DemoSectionHeader()}>
      <div className={styles.DemoSectionHeader.content()}>
        <h2 className={styles.DemoSectionHeader.title()}>{title}</h2>
        {text && <p className={styles.DemoSectionHeader.text()}>{text}</p>}
      </div>
      {link?.href && (
        <DemoButton href={link.href} variant="text">
          {link.label}
        </DemoButton>
      )}
    </header>
  )
}
