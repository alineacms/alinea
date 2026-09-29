import {type CSSProperties, type ReactNode, useState} from 'react'
import {Button} from './Button.js'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from './Resizable.js'
import {Switch} from './Switch.js'
import {Text} from './Text.js'

const frame: CSSProperties = {
  display: 'flex',
  height: 320,
  margin: 24,
  border: '1px solid var(--alinea-border)',
  borderRadius: 8,
  overflow: 'hidden'
}

const toolbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '24px 24px 0'
}

interface BoxProps {
  children: ReactNode
  muted?: boolean
}

function Box({children, muted}: BoxProps) {
  return (
    <div
      style={{
        display: 'grid',
        flex: 1,
        placeItems: 'center',
        background: muted ? 'var(--alinea-bg-muted)' : 'var(--alinea-bg)'
      }}
    >
      <Text color="muted">{children}</Text>
    </div>
  )
}

function formatSizes(sizes: Array<number>) {
  return sizes.map(size => Math.round(size)).join(' / ')
}

export function Horizontal() {
  const [sizes, setSizes] = useState<Array<number>>([])
  return (
    <>
      <div style={toolbar}>
        <Text size="sm" color="muted">
          Layout: <output aria-label="Layout">{formatSizes(sizes)}</output>
        </Text>
      </div>
      <div style={frame}>
        <ResizablePanelGroup onLayout={setSizes}>
          <ResizablePanel
            data-testid="navigation"
            defaultSize={200}
            minSize={150}
            maxSize={300}
            priority="low"
          >
            <Box>Navigation (150 - 300)</Box>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel data-testid="content" minSize={200} priority="high">
            <Box muted>Content</Box>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            data-testid="details"
            defaultSize={240}
            minSize={200}
            priority="low"
          >
            <Box>Details</Box>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}

export function Vertical() {
  return (
    <div style={{...frame, height: 480}}>
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel data-testid="top" minSize={100} priority="high">
          <Box>Editor</Box>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          data-testid="bottom"
          defaultSize={160}
          minSize={80}
          maxSize={320}
          priority="low"
        >
          <Box muted>Console</Box>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

/** A panel hidden without unmounting its content, eg. on small screens */
export function HiddenPanel() {
  const [visible, setVisible] = useState(true)
  return (
    <>
      <div style={toolbar}>
        <Switch checked={visible} onCheckedChange={setVisible}>
          Show sidebar
        </Switch>
      </div>
      <div style={frame}>
        <ResizablePanelGroup>
          <ResizablePanel
            data-testid="sidebar"
            defaultSize={240}
            minSize={160}
            priority="low"
            visible={visible}
          >
            <Box>
              <input aria-label="Sidebar note" defaultValue="" />
            </Box>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel data-testid="content" minSize={200} priority="high">
            <Box muted>Content</Box>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}

/** The size is kept by the caller, eg. in a stored preference */
export function Controlled() {
  const [size, setSize] = useState(280)
  return (
    <>
      <div style={toolbar}>
        <Text size="sm" color="muted">
          Stored width: <output aria-label="Stored width">{size}</output>
        </Text>
        <Button size="sm" variant="outline" onClick={() => setSize(360)}>
          Set to 360
        </Button>
      </div>
      <div style={frame}>
        <ResizablePanelGroup>
          <ResizablePanel
            data-testid="sidebar"
            size={size}
            onSizeChange={setSize}
            defaultSize={240}
            minSize={200}
            maxSize={480}
            priority="low"
          >
            <Box>Double click the divider to reset to 240</Box>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel minSize={200} priority="high">
            <Box muted>Content</Box>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  )
}

export default {
  title: 'Pure components / Resizable'
}
