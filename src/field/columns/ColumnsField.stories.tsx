import {Field} from '#/core/Field.js'
import {Type, type} from '#/core/Type.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {IcOutlineGridView, IcRoundNotes} from '#/dashboard/icons.js'
import {check} from '#/field/check.js'
import {disclosure} from '#/field/disclosure.js'
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
    required: check('Required'),
    ...disclosure('Field', {
      fields: {
        placeholder: text('Placeholder')
      }
    })
  }
})

const emailControl = type('Email field', {
  icon: IcRoundNotes,
  fields: {
    required: check('Required'),
    ...disclosure('Field', {
      fields: {
        placeholder: text('Placeholder')
      }
    })
  }
})

const selectControl = type('Select field', {
  icon: IcOutlineGridView,
  fields: {
    required: check('Required'),
    ...disclosure('Field', {
      fields: {
        choices: select('Choices', {
          options: {one: 'One', two: 'Two', three: 'Three'}
        })
      }
    })
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
    _label: 'Postal code',
    _anchor: 'postal-code',
    placeholder: '1000',
    required: true
  },
  {
    _type: 'Text' as const,
    _layout: {row: 'address', span: 9},
    _label: 'Street and number',
    _anchor: 'street',
    placeholder: 'Main Street 12',
    required: true
  },
  {
    _type: 'Email' as const,
    _layout: {row: 'contact', span: 12},
    _label: 'Email address',
    _anchor: 'email',
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

const readOnlyContactType = type('Read-only contact form', {
  fields: {
    layout: list.columns('Contact details', {
      schema: formControls,
      initialValue: initialFields,
      readOnly: true
    })
  }
})

const storyStyle: CSSProperties = {
  maxWidth: 960,
  padding: 24
}

export function Example() {
  return <ColumnsExample formType={contactType} />
}

export function ReadOnlyExample() {
  return <ColumnsExample formType={readOnlyContactType} />
}

interface ColumnsExampleProps {
  formType: Type
}

function ColumnsExample({formType}: ColumnsExampleProps) {
  const editor = useMemo(
    () =>
      new EntryEditor(formType, new ReactiveNode(Type.initialValue(formType))),
    [formType]
  )
  const layout = Type.fields(formType).layout
  if (!Field.isField(layout)) return null
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
