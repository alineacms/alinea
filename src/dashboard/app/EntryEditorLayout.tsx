import {styler} from '@alinea/styler'
import type {ReactNode} from 'react'
import {BlockSheetSlot, useBlockSheetOpen} from './BlockSheet.js'
import css from './EntryEditorLayout.module.css'
import {SidebarLayout} from './SidebarLayout.js'

const styles = styler(css)

export interface EntryEditorLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

/**
 * An open block sheet covers the sidebar, it shows the sidebar panel on its
 * own while the sidebar is collapsed
 */
export function EntryEditorLayout({sidebar, children}: EntryEditorLayoutProps) {
  const sheetOpen = useBlockSheetOpen()
  return (
    <SidebarLayout
      side="right"
      visible={Boolean(sidebar) || sheetOpen}
      sidebar={
        <div className={styles.EntryEditorLayout.sidebar()}>
          {sidebar}
          <BlockSheetSlot />
        </div>
      }
    >
      {children}
    </SidebarLayout>
  )
}
