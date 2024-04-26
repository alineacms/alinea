import {Config, Field} from 'alinea'

export const BasicFields = Config.document('Basic fields', {
  fields: {
    text: Field.text('Text field'),
    hello: Field.text('Validated text field', {
      help: 'This field only accepts "hello"',
      validate: value => {
        if (value !== 'hello') {
          return 'Only "hello" is allowed'
        }
      }
    }),
    richText: Field.richText('Rich text field', {enableTables: true}),
    select: Field.select('Select field', {
      width: 0.5,
      options: {
        a: 'Option a',
        b: 'Option b'
      }
    }),
    number: Field.number('Number field', {
      minValue: 0,
      maxValue: 10
    }),
    check: Field.check('Check field', {description: 'Check me please'}),
    date: Field.date('Date field'),
    code: Field.code('Code field')
  }
})
