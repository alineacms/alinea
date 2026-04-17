import styler from '@alinea/styler'
import type {HTMLAttributes} from 'react'
import css from './Elevation.module.css'

const styles = styler(css)

export interface ElevationProps extends HTMLAttributes<HTMLDivElement> {}

export function Elevation(props: ElevationProps) {
  return <div {...props} className={styles.Elevation(styler.merge(props))} />
}

export interface ElevationHeaderProps extends HTMLAttributes<HTMLElement> {}

export function ElevationHeader(props: ElevationHeaderProps) {
  return (
    <header
      {...props}
      className={styles.ElevationHeader(styler.merge(props))}
    />
  )
}
