import {Field} from '#/core/Field.js'
import {Type, type} from '#/core/Type.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {IcOutlineGridView, IcRoundNotes} from '#/dashboard/icons.js'
import {check} from '#/field/check.js'
import {list} from '#/field/list.js'
import {ListFieldView} from '#/field/list/ListField.view.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {views} from '../views.js'

const textControl = type('Text field', {
  icon: IcRoundNotes,
  fields: {
    name: text('Name'),
    label: text('Label'),
    placeholder: text('Placeholder'),
    required: check('Required')
  }
})

const emailControl = type('Email field', {
  icon: IcRoundNotes,
  fields: {
    name: text('Name'),
    label: text('Label'),
    placeholder: text('Placeholder'),
    required: check('Required')
  }
})

const selectControl = type('Select field', {
  icon: IcOutlineGridView,
  fields: {
    name: text('Name'),
    label: text('Label'),
    choices: select('Choices', {
      options: {one: 'One', two: 'Two', three: 'Three'}
    }),
    required: check('Required')
  }
})

const formControls = {
  Text: textControl,
  Email: emailControl,
  Select: selectControl
}

const initialFields = [
  {
    _type: 'Text' as const,
    _layout: {row: 'address', span: 3},
    name: 'postalCode',
    label: 'Postal code',
    placeholder: '1000',
    required: true
  },
  {
    _type: 'Text' as const,
    _layout: {row: 'address', span: 9},
    name: 'street',
    label: 'Street and number',
    placeholder: 'Main Street 12',
    required: true
  },
  {
    _type: 'Email' as const,
    _layout: {row: 'contact', span: 12},
    name: 'email',
    label: 'Email address',
    placeholder: 'you@example.com',
    required: true
  }
]

const contactType = type('Contact form', {
  fields: {
    layout: list.columns('Contact details', {
      schema: formControls,
      initialValue: initialFields,
      help: 'Add fields as rows, split rows into columns, and resize them on a twelve-track grid.'
    })
  }
})

const storyStyle: CSSProperties = {
  maxWidth: 960,
  padding: 24
}

export function Example() {
  const editor = useMemo(
    () =>
      new EntryEditor(
        contactType,
        new ReactiveNode(Type.initialValue(contactType))
      ),
    []
  )
  const layout = Field.isField(contactType.layout) ? contactType.layout : null
  if (!layout) return null
  return (
    <StoryProvider views={views}>
      <EditorScope editor={editor}>
        <div style={storyStyle}>
          <ListFieldView
            field={layout as Parameters<typeof ListFieldView>[0]['field']}
          />
        </div>
      </EditorScope>
    </StoryProvider>
  )
}
