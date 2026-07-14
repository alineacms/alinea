import {suite} from '@alinea/suite'
import {Field} from '#/core/Field.js'
import {richText} from '#/field/richtext/RichTextField.js'

const test = suite(import.meta)

test('Field.richText references the richtext2 views', () => {
  const field = richText('Body')

  test.is(
    Field.view(field),
    'alinea/field/richtext2/RichTextField.view#RichTextFieldView'
  )
  test.is(
    Field.compactView(field),
    'alinea/field/richtext2/RichTextField.view#RichTextFieldCompactView'
  )
})
