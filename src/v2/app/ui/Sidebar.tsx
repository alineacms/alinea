import styler from '@alinea/styler'
import type {HTMLAttributes, PropsWithChildren} from 'react'
import {Rail, RailHeader, RailHeaderProps, RailProps} from './Rail.js'
import css from './Sidebar.module.css'

const styles = styler(css)

export interface SidebarProps extends RailProps {}

export function Sidebar(props: SidebarProps) {
  return <Rail className={styles.Sidebar(styler.merge(props))} {...props} />
}

export interface SidebarHeaderProps extends RailHeaderProps {}

export function SidebarHeader(props: SidebarHeaderProps) {
  return <RailHeader {...props} />
}

export interface SidebarBodyProps
  extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  scroll?: boolean
}

export function SidebarBody({children, ...props}: SidebarBodyProps) {
  return (
    <div {...props} className={styles.SidebarBody()}>
      {children}
    </div>
  )
}

export interface SidebarFooterProps
  extends PropsWithChildren, HTMLAttributes<HTMLElement> {}

export function SidebarFooter({
  children,
  className,
  ...props
}: SidebarFooterProps) {
  return (
    <footer
      {...props}
      className={styles.SidebarFooter(styler.merge({className}))}
    >
      {children}
    </footer>
  )
}
