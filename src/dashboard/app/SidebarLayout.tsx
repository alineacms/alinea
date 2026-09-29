import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '#/components.js'
import {useAtom, useAtomValueRaw} from 'jotai'
import type {ReactNode} from 'react'
import {
  dashboardMobileAtom,
  entrySidebarWidthAtom,
  navigationSidebarWidthAtom
} from '../atoms/dashboard.js'

const defaultWidth = 320

export interface SidebarLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  side: 'left' | 'right'
  visible?: boolean
}

/** Places a resizable sidebar next to the content, remembering its width */
export function SidebarLayout({
  children,
  sidebar,
  side,
  visible = true
}: SidebarLayoutProps) {
  const isMobile = useAtomValueRaw(dashboardMobileAtom)
  const [width, setWidth] = useAtom(
    side === 'left' ? navigationSidebarWidthAtom : entrySidebarWidthAtom
  )
  const sidebarVisible = visible && (side === 'right' || !isMobile)
  const sidebarPanel = (
    <ResizablePanel
      key="sidebar"
      size={width}
      defaultSize={defaultWidth}
      minSize={isMobile ? 0 : side === 'left' ? 200 : 300}
      maxSize={isMobile ? Infinity : side === 'left' ? 480 : 640}
      priority="low"
      onSizeChange={size => {
        if (!isMobile) setWidth(size)
      }}
    >
      {sidebar}
    </ResizablePanel>
  )
  return (
    <ResizablePanelGroup data-side={side}>
      {sidebarVisible && side === 'left' && sidebarPanel}
      {sidebarVisible && side === 'left' && <ResizableHandle />}
      <ResizablePanel
        key="content"
        minSize={isMobile ? 0 : side === 'left' ? 500 : 200}
        priority="high"
        visible={!isMobile || side === 'left' || !sidebarVisible}
      >
        {children}
      </ResizablePanel>
      {sidebarVisible && side === 'right' && <ResizableHandle />}
      {sidebarVisible && side === 'right' && sidebarPanel}
    </ResizablePanelGroup>
  )
}
