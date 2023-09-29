import {HTMLProps, PropsWithChildren} from 'react'
import css from './Sink.module.scss'
import {ElevationProvider} from './util/Elevation.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export namespace Sink {
  export function Root(props: PropsWithChildren<HTMLProps<HTMLDivElement>>) {
    return (
      <ElevationProvider type="sink">
        <div className={styles.root()} {...props} />
      </ElevationProvider>
    )
  }
  export const Row = styles.row.toElement('div')
  export const Content = styles.content.toElement('div')
  export const Options = styles.options.toElement('div')
  export const Header = styles.header.toElement('header')
  export const Title = styles.title.toElement('p')
}
