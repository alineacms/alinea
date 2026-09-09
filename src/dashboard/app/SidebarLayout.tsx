import {styler} from '@alinea/styler'
import {Allotment, LayoutPriority, type AllotmentHandle} from 'allotment'
import {useAtom, useAtomValueRaw} from 'jotai'
import {useRef, type ReactNode} from 'react'
import {
  dashboardMobileAtom,
  entrySidebarWidthAtom,
  navigationSidebarWidthAtom
} from '../atoms/dashboard.js'
import css from './SidebarLayout.module.css'

const styles = styler(css)

export interface SidebarLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  side: 'left' | 'right'
  visible?: boolean
}

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
  const container = useRef<HTMLDivElement>(null)
  const allotment = useRef<AllotmentHandle>(null)
  const sidebarVisible = visible && (side === 'right' || !isMobile)

  function saveWidth(sizes: number[]) {
    const size = sizes[side === 'left' ? 0 : 1]
    if (!isMobile && size > 0) setWidth(size)
  }

  function resetWidth() {
    if (!container.current) return
    const remaining = container.current.clientWidth - 320
    allotment.current?.resize(
      side === 'left' ? [320, remaining] : [remaining, 320]
    )
    setWidth(320)
  }

  const sidebarPane = (
    <Allotment.Pane
      key="sidebar"
      minSize={isMobile ? 0 : side === 'left' ? 200 : 300}
      maxSize={isMobile ? Infinity : side === 'left' ? 480 : 640}
      preferredSize={width}
      priority={LayoutPriority.Low}
    >
      {sidebar}
    </Allotment.Pane>
  )

  return (
    <div ref={container} className={styles.SidebarLayout()} data-side={side}>
      <Allotment
        ref={allotment}
        defaultSizes={
          sidebarVisible
            ? side === 'left'
              ? [width, 500]
              : [200, width]
            : [500]
        }
        proportionalLayout={false}
        onDragEnd={saveWidth}
        onReset={resetWidth}
      >
        {sidebarVisible && side === 'left' && sidebarPane}
        <Allotment.Pane
          key="content"
          minSize={isMobile ? 0 : side === 'left' ? 500 : 200}
          priority={LayoutPriority.High}
          visible={!isMobile || side === 'left' || !sidebarVisible}
        >
          <div className={styles.SidebarLayout.content()}>{children}</div>
        </Allotment.Pane>
        {sidebarVisible && side === 'right' && sidebarPane}
      </Allotment>
    </div>
  )
}
