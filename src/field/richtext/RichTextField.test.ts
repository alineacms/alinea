import {suite} from '@alinea/suite'
import {Field} from '#/core/Field.js'
import {Type, type} from '#/core/Type.js'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {
  Dashboard,
  createEditor,
  ReactiveNode
} from '#/dashboard/store/Dashboard.js'
import {
  configureRichTextExtensions,
  richText
} from '#/field/richtext/RichTextField.js'
import {check} from '#/field/check/CheckField.js'
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

test('rejects eager rich text extension configuration', () => {
  test.throws(
    () => configureRichTextExtensions({} as never, {}),
    'Rich text extensions must be configured with a function'
  )
})

test('nested editor fields inherit a read-only reactive node', () => {
  const details = richText('Details')
  const block = type('Block', {fields: {details}})
  const editor = createEditor(
    {} as Dashboard,
    block,
    new ReactiveNode<object>({details: []}, true)
  )
  const field = editor.get(details)
  if (!field) throw new Error('Nested field not found')

  const options = createStore().get(field.options)
  test.is(options.readOnly, true)
})

test('legacy blocks receive initial values for newly added fields', () => {
  const block = type('Block', {
    fields: {
      enabled: check('Enabled'),
      nested: richText('Nested')
    }
  })
  const body = richText('Body', {schema: {Block: block}})
  const document = type('Document', {fields: {body}})
  const value = Type.withInitialValue(document, {
    body: [{[Node.type]: 'Block', [BlockNode.id]: 'legacy'}]
  })

  test.equal(value, {
    body: [
      {
        [Node.type]: 'Block',
        [BlockNode.id]: 'legacy',
        enabled: undefined,
        nested: []
      }
    ]
  })
})
