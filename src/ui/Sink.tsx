import styler from '@alinea/styler'
import type {HTMLProps, PropsWithChildren} from 'react'
import css from './Sink.module.scss'
import {ElevationProvider} from './util/Elevation.js'

const styles = styler(css)

export namespace Sink {
  export function Root(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return (
      <ElevationProvider type="sink">
        <div className={styles.root()} {...props} />
      </ElevationProvider>
    )
  }
  export function Row(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return <div {...props} className={styles.row(styler.merge(props))} />
  }
  export function Content(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return <div {...props} className={styles.content(styler.merge(props))} />
  }
  export function Options(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return <div {...props} className={styles.options(styler.merge(props))} />
  }
  export function Header(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return <header {...props} className={styles.header(styler.merge(props))} />
  }
  export function Title(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return <p {...props} className={styles.title(styler.merge(props))} />
  }
}
