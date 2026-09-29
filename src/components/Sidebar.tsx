import styler from '@alinea/styler'
import {createContext, type ReactNode, type Ref, useContext, useId} from 'react'
import css from './Sidebar.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface SidebarProps extends StyleProps, AriaProps, DataProps {
  /**
   * The edge of the layout the sidebar is placed on, defaults to left.
   * Exposed as `data-side` for styling.
   */
  side?: 'left' | 'right'
  children: ReactNode
}

/**
 * A column next to the SidebarInset, eg. the content tree or entry details.
 * Place it in a ResizablePanel to make it resizable. On small screens it
 * covers the layout.
 */
export function Sidebar({side = 'left', className, ...props}: SidebarProps) {
  return (
    <div
      data-slot="sidebar"
      {...props}
      data-side={side}
      className={styles.Sidebar(styler.merge({className}))}
    />
  )
}

export interface SidebarHeaderProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

export function SidebarHeader({className, ...props}: SidebarHeaderProps) {
  return (
    <header
      data-slot="sidebar-header"
      {...props}
      className={styles.SidebarHeader(styler.merge({className}))}
    />
  )
}

export interface SidebarContentProps extends StyleProps, AriaProps, DataProps {
  /** Scroll the content when it overflows, leave off when children scroll */
  scroll?: boolean
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/** Fills the space between the header and footer */
export function SidebarContent({
  scroll,
  className,
  ...props
}: SidebarContentProps) {
  return (
    <div
      data-slot="sidebar-content"
      {...props}
      data-scroll={scroll || undefined}
      className={styles.SidebarContent(styler.merge({className}))}
    />
  )
}

export interface SidebarFooterProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

export function SidebarFooter({className, ...props}: SidebarFooterProps) {
  return (
    <footer
      data-slot="sidebar-footer"
      {...props}
      className={styles.SidebarFooter(styler.merge({className}))}
    />
  )
}

export interface SidebarGroupProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

const SidebarGroupLabelId = createContext<string | undefined>(undefined)

/** A section of the sidebar, optionally titled with a SidebarGroupLabel */
export function SidebarGroup({
  className,
  children,
  ...props
}: SidebarGroupProps) {
  const labelId = useId()
  return (
    <div
      data-slot="sidebar-group"
      role="group"
      aria-labelledby={labelId}
      {...props}
      className={styles.SidebarGroup(styler.merge({className}))}
    >
      <SidebarGroupLabelId.Provider value={labelId}>
        {children}
      </SidebarGroupLabelId.Provider>
    </div>
  )
}

export interface SidebarGroupLabelProps extends StyleProps, DataProps {
  /** Defaults to an id that labels the surrounding SidebarGroup */
  id?: string
  children: ReactNode
}

export function SidebarGroupLabel({
  className,
  ...props
}: SidebarGroupLabelProps) {
  const id = useContext(SidebarGroupLabelId)
  return (
    <div
      data-slot="sidebar-group-label"
      id={id}
      {...props}
      className={styles.SidebarGroupLabel(styler.merge({className}))}
    />
  )
}

export interface SidebarGroupActionProps extends StyleProps, DataProps {
  children: ReactNode
}

/**
 * Places a small control, eg. a Button or DropdownMenuTrigger with
 * `size="sm"`, at the end of the group label.
 */
export function SidebarGroupAction({
  className,
  ...props
}: SidebarGroupActionProps) {
  return (
    <div
      data-slot="sidebar-group-action"
      {...props}
      className={styles.SidebarGroupAction(styler.merge({className}))}
    />
  )
}

export interface SidebarInsetProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/** The main content column next to the sidebars */
export function SidebarInset({className, ...props}: SidebarInsetProps) {
  return (
    <div
      data-slot="sidebar-inset"
      {...props}
      className={styles.SidebarInset(styler.merge({className}))}
    />
  )
}
