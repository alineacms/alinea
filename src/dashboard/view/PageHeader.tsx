import {fromModule} from 'alinea/ui'
import {HTMLProps} from 'react'
import css from './PageHeader.module.scss'

const styles = fromModule(css)

export function PageHeader(props: HTMLProps<HTMLElement>) {
  return <header {...props} className={styles.root.mergeProps(props)()} />
}

export namespace PageHeader {
  export function Content(props: HTMLProps<HTMLDivElement>) {
    return <div {...props} className={styles.content.mergeProps(props)()} />
  }
}
