import {type FieldsDefinition, Type, type} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {object} from '#/field/object.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {views} from '../views.js'

const storyStyle: CSSProperties = {padding: 20, maxWidth: 640}

function address(collapsed?: boolean) {
  return object('Address', {
    collapsed,
    help: 'Where the venue is',
    fields: {
      street: text('Street', {initialValue: 'Main street 1'}),
      city: text('City', {initialValue: 'Brussels'})
    }
  })
}

interface ObjectStoryProps {
  fields: FieldsDefinition
}

function ObjectStory({fields}: ObjectStoryProps) {
  const objectType = useMemo(() => type('Venue', {fields}), [fields])
  const node = useMemo(
    () => new ReactiveNode(Type.initialValue(objectType) as object),
    [objectType]
  )
  return (
    <StoryProvider views={views}>
      <div style={storyStyle}>
        <NodeEditor node={node} type={objectType} />
      </div>
    </StoryProvider>
  )
}

const example = {address: address()}
const collapsed = {address: address(true)}
const inline = {
  address: object('Address', {
    inline: true,
    fields: {street: text('Street'), city: text('City')}
  })
}

export function Example() {
  return <ObjectStory fields={example} />
}

export function Collapsed() {
  return <ObjectStory fields={collapsed} />
}

export function Inline() {
  return <ObjectStory fields={inline} />
}

export default {
  title: 'Fields / ObjectField'
}
