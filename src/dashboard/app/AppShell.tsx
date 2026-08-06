import styler from '@alinea/styler'
import {HTMLProps} from 'react'
import css from './AppShell.module.css'

const styles = styler(css)

export function AppShell(props: HTMLProps<HTMLElement>) {
  return <main className={styles.AppShell()} {...props} />
}

export function AppShellInner(props: HTMLProps<HTMLDivElement>) {
  return <div className={styles.AppShellInner()} {...props} />
}

export function AppShellContent(props: HTMLProps<HTMLDivElement>) {
  return <div className={styles.AppShellContent()} {...props} />
}
