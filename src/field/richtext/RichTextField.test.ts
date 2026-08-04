import {suite} from '@alinea/suite'
import {Field} from '#/core/Field.js'
import {type, Type} from '#/core/Type.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {richText} from '#/field/richtext/RichTextField.js'
import {select} from '#/field/select.js'
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
  const editor = new EntryEditor(
    block,
    new ReactiveNode<object>({details: []}, true)
  )
  const field = editor.get(details)
  if (!field) throw new Error('Nested field not found')

  const options = createStore().get(field.options)
  test.is(options.readOnly, true)
})

test('existing rich text blocks receive newly added field defaults', () => {
  const variant = select('Variant', {
    options: {primary: 'Primary', secondary: 'Secondary'},
    initialValue: 'primary'
  })
  const details = richText('Details')
  const block = type('Call to action', {fields: {variant, details}})
  const body = richText('Body', {schema: {Cta: block}})
  const entry = type('Entry', {fields: {body}})
  const value = {
    body: [{_type: 'Cta', _id: 'cta-1'}]
  }

  const initialized = Type.withInitialValue(entry, value)

  test.equal(initialized.body, [
    {
      _type: 'Cta',
      _id: 'cta-1',
      variant: 'primary',
      details: []
    }
  ])
  test.is(Type.withInitialValue(entry, initialized), initialized)
})
