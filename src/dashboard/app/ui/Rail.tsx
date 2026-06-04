import {styler} from '@alinea/styler'
import {
  createContext,
  useContext,
  type HTMLProps,
  type ReactNode
} from 'react'
import css from './Rail.module.css'

const styles = styler(css)
const RailMainContext = createContext(false)

export interface RailProps extends HTMLProps<HTMLDivElement> {
  main?: boolean
}

export function Rail({main, ...props}: RailProps) {
  return (
    <RailMainContext.Provider value={Boolean(main)}>
      <div {...props} className={styles.Rail(styler.merge(props), {main})} />
    </RailMainContext.Provider>
  )
}

export interface RailHeaderProps extends HTMLProps<HTMLElement> {}

export function RailHeader(props: RailHeaderProps) {
  const isMain = useContext(RailMainContext)
  return (
    <header {...props} className={styles.RailHeader(styler.merge(props))}>
      {isMain ? <RailContent>{props.children}</RailContent> : props.children}
    </header>
  )
}

export interface RailBodyProps extends HTMLProps<HTMLDivElement> {}

export function RailBody(props: RailBodyProps) {
  const isMain = useContext(RailMainContext)
  return (
    <div {...props} className={styles.RailBody(styler.merge(props))}>
      {isMain ? <RailContent>{props.children}</RailContent> : props.children}
    </div>
  )
}

export interface RailFooterProps extends HTMLProps<HTMLElement> {}

export function RailFooter(props: RailFooterProps) {
  return (
    <footer {...props} className={styles.RailFooter(styler.merge(props))} />
  )
}

export interface RailContentProps extends HTMLProps<HTMLDivElement> {
  children?: ReactNode
}

export function RailContent(props: RailContentProps) {
  return <div {...props} className={styles.RailContent(styler.merge(props))} />
}
