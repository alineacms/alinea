import {useState} from 'react'
import {PreviewFrame, PreviewToolbar} from './PreviewFrame.js'
import {Text} from './Text.js'

const pages = ['Home', 'About', 'Contact'].map(
  title =>
    `data:text/html,${encodeURIComponent(
      `<body style="font-family:sans-serif;padding:24px"><h1>${title}</h1><p>A previewed page</p></body>`
    )}`
)

const frameStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: 420,
  height: 360,
  margin: 24,
  border: '1px solid var(--alinea-border)',
  borderRadius: 8,
  overflow: 'hidden'
} as const

export function Example() {
  const [index, setIndex] = useState(0)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [opened, setOpened] = useState(0)
  function go(next: number) {
    setLoading(true)
    setIndex(next)
  }
  return (
    <div>
      <div style={frameStyle}>
        <PreviewToolbar
          onBack={index > 0 ? () => go(index - 1) : undefined}
          onForward={index < pages.length - 1 ? () => go(index + 1) : undefined}
          onReload={() => {
            setLoading(true)
            setVersion(version + 1)
          }}
          onOpen={() => setOpened(opened + 1)}
        >
          <Text size="sm" color="muted">
            Page {index + 1} of {pages.length}
          </Text>
        </PreviewToolbar>
        <PreviewFrame
          key={version}
          title="Page preview"
          src={pages[index]}
          loading={loading}
          onLoad={() => setLoading(false)}
        />
      </div>
      <Text style={{marginInline: 24}}>Opened {opened} times</Text>
    </div>
  )
}

export function Unavailable() {
  return (
    <div style={frameStyle}>
      <PreviewToolbar />
      <PreviewFrame
        title="Page preview"
        unavailable="Preview is currently unavailable."
      />
    </div>
  )
}

export function Loading() {
  return (
    <div style={frameStyle}>
      <PreviewToolbar reloading onReload={() => {}} />
      <PreviewFrame title="Page preview" loading />
    </div>
  )
}

export default {
  title: 'Pure components / PreviewFrame'
}
