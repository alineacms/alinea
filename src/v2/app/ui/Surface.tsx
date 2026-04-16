import {styler} from '@alinea/styler'
import type {HTMLProps} from 'react'
import css from './Surface.module.css'

const styles = styler(css)

export function Surface(props: HTMLProps<HTMLDivElement>) {
  return <div {...props} className={styles.Surface(styler.merge(props))} />
}

export function SurfaceRow(props: HTMLProps<HTMLDivElement>) {
  return <div {...props} className={styles.SurfaceRow(styler.merge(props))} />
}

export function SurfaceContent(props: HTMLProps<HTMLDivElement>) {
  return (
    <div {...props} className={styles.SurfaceContent(styler.merge(props))} />
  )
}

export function SurfaceHeader(props: HTMLProps<HTMLDivElement>) {
  return (
    <header {...props} className={styles.SurfaceHeader(styler.merge(props))} />
  )
}
