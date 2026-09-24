'use client'

import {PreviewFrame, PreviewToolbar, Text} from 'alinea/components'
import {useState} from 'react'

const page = `data:text/html,${encodeURIComponent(
  '<body style="font-family:sans-serif"><h1>Linen shirt</h1><p>€89</p></body>'
)}`

export function PreviewFrameExample() {
  const [version, setVersion] = useState(0)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 420,
        height: 260
      }}
    >
      <PreviewToolbar onReload={() => setVersion(version + 1)}>
        <Text size="sm" color="muted">
          /products/linen-shirt
        </Text>
      </PreviewToolbar>
      <PreviewFrame key={version} title="Preview of Linen shirt" src={page} />
    </div>
  )
}
