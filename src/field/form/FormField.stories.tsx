import {Type, type} from '#/core/Type.js'
import {BlockSheetStoryFrame} from '#/dashboard/app/BlockSheetStoryFrame.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {IcRoundStarOutline} from '#/dashboard/icons.js'
import {number} from '#/field/number.js'
import '#/theme.css'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {views} from '../views.js'
import {form} from './FormField.js'
import {input} from './FormInput.js'
import {defaults} from './FormInputs.js'

const rating = input('Rating', {
  icon: IcRoundStarOutline,
  settings: {max: number('Maximum', {initialValue: 5})},
  parse: ([raw]) => (raw ? Number(raw) : undefined),
  attributes: settings => ({min: 1, max: settings.max ?? undefined})
})

const serviceRequest = type('Service request', {
  fields: {
    inputs: form('Inputs', {inputs: {...defaults, rating}})
  }
})

const rows = [
  {
    _id: 'about',
    _index: 'a0',
    _type: 'section',
    label: 'About you',
    inputs: [
      {_id: 'name', _index: 'a0', _type: 'text', label: 'Name', required: true},
      {
        _id: 'email',
        _index: 'a1',
        _type: 'email',
        label: 'Email',
        required: true
      },
      {_id: 'phone', _index: 'a2', _type: 'tel', label: 'Phone'}
    ]
  },
  {
    _id: 'request',
    _index: 'a1',
    _type: 'section',
    label: 'Your request',
    inputs: [
      {
        _id: 'service',
        _index: 'a0',
        _type: 'radio',
        label: 'Service',
        required: true,
        options: [
          {_id: 'it', _index: 'a0', _type: 'option', label: 'IT'},
          {
            _id: 'facilities',
            _index: 'a1',
            _type: 'option',
            label: 'Facilities'
          }
        ]
      },
      {
        _id: 'description',
        _index: 'a1',
        _type: 'textarea',
        label: 'Description',
        help: 'Tell us what happened and when',
        required: true,
        maxLength: 2000
      },
      {_id: 'screenshots', _index: 'a2', _type: 'file', label: 'Screenshots'},
      {
        _id: 'rating',
        _index: 'a3',
        _type: 'rating',
        label: 'How did we do last time?'
      }
    ]
  },
  {
    _id: 'privacy',
    _index: 'a2',
    _type: 'check',
    label: 'I agree to the privacy policy',
    required: true
  }
]

const storyStyle: CSSProperties = {
  maxWidth: 760,
  padding: 24
}

export function Builder() {
  const node = useMemo(
    () =>
      new ReactiveNode(
        Type.withInitialValue(serviceRequest, {inputs: rows}) as object
      ),
    []
  )
  return (
    <StoryProvider views={views}>
      <BlockSheetStoryFrame>
        <div style={storyStyle}>
          <NodeEditor node={node} type={serviceRequest} />
        </div>
      </BlockSheetStoryFrame>
    </StoryProvider>
  )
}

const emptyForm = type('Contact', {
  fields: {inputs: form('Inputs', {inputs: defaults})}
})

export function Empty() {
  const node = useMemo(
    () => new ReactiveNode(Type.initialValue(emptyForm) as object),
    []
  )
  return (
    <StoryProvider views={views}>
      <BlockSheetStoryFrame>
        <div style={storyStyle}>
          <NodeEditor node={node} type={emptyForm} />
        </div>
      </BlockSheetStoryFrame>
    </StoryProvider>
  )
}

export default {
  title: 'Fields / FormField'
}
