import {Config, Field} from 'alinea'

export const RichTextFields = Config.document('Rich text fields', {
  fields: {
    withInitial: Field.richText('With initial value', {
      searchable: true,
      required: true,
      initialValue: [
        {
          _type: 'paragraph',
          content: [
            {
              _type: 'text',
              text: 'This is a paragraph with initial value'
            }
          ]
        }
      ]
    }),
    makeRO: Field.check('Make read-only'),
    nested: Field.richText('With nested blocks', {
      searchable: true,
      schema: {
        Inner: Config.type('Inner', {
          fields: {
            checkbox1: Field.check('Checkbox 1'),
            checkbox2: Field.check('Checkbox 2'),
            title: Field.text('Title'),
            content: Field.richText('Inner rich text', {
              searchable: true
            })
          }
        }),

        NestLayout: Config.type('Nested layout fields', {
          fields: {
            object: Field.object('Object field', {
              fields: {
                fieldA: Field.text('Field A', {width: 0.5}),
                fieldB: Field.text('Field B', {width: 0.5})
              }
            }),
            ...Field.tabs(
              Field.tab('Tab A', {
                fields: {tabA: Field.text('Tab A')}
              }),
              Field.tab('Tab B', {
                fields: {tabB: Field.text('Tab B')}
              })
            )
          }
        })
      }
    })
  }
})
