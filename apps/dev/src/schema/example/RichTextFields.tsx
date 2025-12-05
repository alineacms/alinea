import {Config, Field} from 'alinea'
import {
  alignment,
  formatting,
  headings,
  inserts,
  links,
  lists,
  quotes,
  tables
} from 'alinea/field/richtext/Toolbar'

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
    }),
    table: Field.richText('With table support', {
      enableTables: true,
      toolbar: {
        headings,
        table: {
          ...tables,
          items(ctx) {
            const base =
              (typeof tables.menu === 'function' ? tables.items(ctx) : {}) ?? {}
            if (ctx.editor.isActive('table')) return base
            return {
              quickInsert: {
                label: 'Quick 2x4 table',
                onSelect: ({exec}) =>
                  exec()
                    .insertTable({rows: 2, cols: 4, withHeaderRow: false})
                    .run()
              },
              ...base
            }
          }
        },
        formatting,
        alignment,
        lists,
        links,
        quotes,
        inserts
      }
    })
  }
})
