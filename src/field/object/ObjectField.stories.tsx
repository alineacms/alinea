import {Type, type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {object} from '#/field/object.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import {useMemo} from 'react'
import {views} from '../views.js'

const pageType = type('Page', {
  fields: {
    openGraph: object('Open Graph', {
      help: 'A fixed group of related fields',
      fields: {
        title: text('Title', {initialValue: 'Build structured pages'}),
        description: text('Description', {multiline: true})
      }
    })
  }
})

export function Example() {
  const node = useMemo(
    () => new ReactiveNode(Type.initialValue(pageType) as object),
    []
  )
  return (
    <StoryProvider views={views}>
      <div style={{maxWidth: 760, padding: 24}}>
        <NodeEditor node={node} type={pageType} />
      </div>
    </StoryProvider>
  )
}

export default {
  title: 'Fields / ObjectField'
}
