'use client'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Surface,
  SurfaceContent
} from 'alinea/components'

export function ResizablePanelGroupExample() {
  return (
    <Surface style={{display: 'flex', width: 560, height: 220}}>
      <ResizablePanelGroup>
        <ResizablePanel defaultSize={180} minSize={120} maxSize={280}>
          <SurfaceContent>Pages</SurfaceContent>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={200} priority="high">
          <SurfaceContent>Linen shirt</SurfaceContent>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={160} minSize={120}>
          <SurfaceContent>Details</SurfaceContent>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Surface>
  )
}
