import {Type, type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {localiser} from '#/field/localiser.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import {useAtomValue} from 'jotai'
import type {CSSProperties} from 'react'
import {views} from '../views'

const localise = localiser({locales: ['nl', 'fr']})

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

const node = new ReactiveNode(Type.initialValue(pageType) as object)

export function Example() {
  return (
    <StoryProvider views={views}>
      <div style={storyStyle}>
        <NodeEditor node={node} type={pageType} />
        <ValuePreview node={node} />
      </div>
    </StoryProvider>
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
