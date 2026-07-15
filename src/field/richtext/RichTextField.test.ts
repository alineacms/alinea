import {suite} from '@alinea/suite'
import {Field} from '#/core/Field.js'
import {type} from '#/core/Type.js'
import {
  Dashboard,
  DashboardEditor,
  ReactiveNode
} from '#/dashboard/store/Dashboard.js'
import {richText} from '#/field/richtext/RichTextField.js'
import {createStore} from 'jotai'

const test = suite(import.meta)

test('Field.richText references the richtext views', () => {
  const field = richText('Body')

  test.is(
    Field.view(field),
    'alinea/field/richtext/RichTextField.view#RichTextFieldView'
  )
  test.is(
    Field.compactView(field),
    'alinea/field/richtext/RichTextField.view#RichTextFieldCompactView'
  )
})

test('nested editor fields inherit a read-only reactive node', () => {
  const details = richText('Details')
  const block = type('Block', {fields: {details}})
  const editor = new DashboardEditor(
    {} as Dashboard,
    block,
    new ReactiveNode<object>({details: []}, true)
  )
  const field = editor.get(details)
  if (!field) throw new Error('Nested field not found')

  const options = createStore().get(field.options)
  test.is(options.readOnly, true)
})
