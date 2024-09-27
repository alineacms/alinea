import styler from '@alinea/styler'
import {HTMLProps} from 'react'
import css from './Lift.module.scss'
import {ElevationProvider} from './util/Elevation.js'

const styles = styler(css)

export function Lift(props: HTMLProps<HTMLDivElement>) {
  return (
    <ElevationProvider type="lift">
      <div {...props} className={styles.root.mergeProps(props)()} />
    </ElevationProvider>
  )
}

export function LiftHeader(props: HTMLProps<HTMLDivElement>) {
  return <header {...props} className={styles.header.mergeProps(props)()} />
}
