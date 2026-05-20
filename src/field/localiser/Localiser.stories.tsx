import {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Type, type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {
  Dashboard,
  DashboardScopeInternal,
  ReactiveNode
} from '#/dashboard/store.js'
import {localiser} from '#/field/localiser.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import {config} from '#test/example.js'
import {useAtomValue} from 'jotai'
import type {CSSProperties} from 'react'
import {views} from '../views'

const localise = localiser(['nl', 'fr'] as const)

const pageType = type('Page', {
  fields: {
    title: localise(text('Title')),
    introduction: localise(text('Introduction', {multiline: true}))
  }
})

const storyStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
  maxWidth: 680,
  padding: 24
}

const previewStyle: CSSProperties = {
  background: 'var(--alinea-bg-muted)',
  border: '1px solid var(--alinea-border)',
  borderRadius: 6,
  color: 'var(--alinea-fg)',
  font: 'inherit',
  margin: 0,
  padding: 12,
  whiteSpace: 'pre-wrap'
}

const dashboard = new Dashboard(
  {} as WriteableGraph,
  config,
  new EventTarget(),
  undefined!,
  views
)
const node = new ReactiveNode(Type.initialValue(pageType) as object)

export function Example() {
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={storyStyle}>
        <NodeEditor node={node} type={pageType} />
        <ValuePreview node={node} />
      </div>
    </DashboardScopeInternal>
  )
}

interface ValuePreviewProps {
  node: ReactiveNode<object>
}

function ValuePreview({node}: ValuePreviewProps) {
  const value = useAtomValue(node.value)
  return <pre style={previewStyle}>{JSON.stringify(value, null, 2)}</pre>
}

export default {
  title: 'Fields / Localiser'
}
