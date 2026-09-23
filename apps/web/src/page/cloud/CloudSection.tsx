import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './CloudSection.module.scss'

const styles = styler(css)

export interface CloudSectionProps {
  id?: string
  title: string
  description: string
}

export function CloudSection({
  id,
  title,
  description,
  children
}: PropsWithChildren<CloudSectionProps>) {
  return (
    <section id={id} className={styles.root()}>
      <header className={styles.root.header()}>
        <h2 className={styles.root.title()}>{title}</h2>
        <p className={styles.root.description()}>{description}</p>
      </header>
      {children}
    </section>
  )
}
