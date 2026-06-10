import { Config, Field } from 'alinea'

export const BasicFields = Config.document('Basic fields', {
  fields: {
    path: Field.path('Path (read-only)', {
      readOnly: true,
      required: true,
      width: 0.5,
    }),
    text: Field.text('Text field'),
    hello: Field.text('Text field with validation', {
      help: <p>This field only accepts "<b>hello</b>"</p>,
      validate: value => {
        if (value !== 'hello') {
          return 'Only "hello" is allowed'
        }
      }
    }),
    richText: Field.richText('Rich text field', {enableTables: true}),
    select: Field.select('Select field', {
      options: {
        a: 'Option a',
        b: 'Option b'
      }
    }),
    number: Field.number('Number field', {
      minValue: 0,
      maxValue: 10,
      help: 'minValue: 0, maxValue: 10'
    }),
    check: Field.check('Check field', {description: 'Check me please'}),
    date: Field.date('Date field', {width: 0.5}),
    time: Field.time('Time field', {width: 0.5}),
    code: Field.code('Code field'),
    object: Field.object('Object', {
      help: 'An object field',
      fields: {
        image: Field.image('Image'),
        title: Field.text('Title'),
        cta: Field.link('Call to action', {
          location: {workspace: 'main', root: 'pages'}
        })
      }
    })
  }
})
