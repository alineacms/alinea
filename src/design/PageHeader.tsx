import styler from '@alinea/styler'
import type {PropsWithChildren} from 'react'
import css from './PageHeader.module.css'

const styles = styler(css)

export interface PageHeaderProps extends PropsWithChildren {
  size?: 'compact' | 'default'
}

export function PageHeader({children, size = 'default'}: PageHeaderProps) {
  return (
    <header className={styles['alinea-PageHeader']()} data-size={size}>
      {children}
    </header>
  )
}

export function PageHeaderMain({children}: PropsWithChildren) {
  return <div className={styles['alinea-PageHeader-main']()}>{children}</div>
}

export function PageHeaderTitle({children}: PropsWithChildren) {
  return <h1 className={styles['alinea-PageHeader-title']()}>{children}</h1>
}

export function PageHeaderTools({children}: PropsWithChildren) {
  return <div className={styles['alinea-PageHeader-tools']()}>{children}</div>
}

export function PageHeaderSearch({children}: PropsWithChildren) {
  return <div className={styles['alinea-PageHeader-search']()}>{children}</div>
}

export function PageHeaderActions({children}: PropsWithChildren) {
  return <div className={styles['alinea-PageHeader-actions']()}>{children}</div>
}
