import {createSchema, docFromEntry, type} from '@alinea/core'
import {list} from '@alinea/input.list'
import {path} from '@alinea/input.path'
import {richText} from '@alinea/input.richtext'
import {text} from '@alinea/input.text'
import {test} from 'uvu'
import * as Y from 'yjs'

const entry: any = {
  id: '20580nQzbOBR3Lt4kIdxyRGglc6',
  type: 'Doc',
  title: 'Getting started',
  body: {
    type: 'doc',
    blocks: {
      '1zzs6wF0OYU4VjlgWH0Yr7TjE0I': {
        type: 'CodeBlock',
        code: 'Dit is mijn codeblock'
      },
      '200Cjwa5GRksoKNE5CK6A8xujMC': {
        type: 'Inception',
        wysiwyg: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: {
                level: 1
              },
              content: [
                {
                  type: 'text',
                  text: 'Dit is een wysiwyg'
                }
              ]
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'In een wysiwyg'
                }
              ]
            }
          ]
        }
      }
    },
    content: [
      {
        type: 'heading',
        attrs: {
          level: 1
        },
        content: [
          {
            type: 'text',
            text: 'Getting started'
          }
        ]
      },
      {
        type: 'paragraph'
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is the body text.'
          }
        ]
      },
      {
        type: 'paragraph'
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'And '
          },
          {
            type: 'text',
            text: 'more',
            marks: [
              {
                type: 'italic'
              }
            ]
          },
          {
            type: 'text',
            text: ' text.'
          }
        ]
      },
      {
        type: 'paragraph'
      },
      {
        type: 'Inception',
        attrs: {
          id: '200Cjwa5GRksoKNE5CK6A8xujMC'
        }
      }
    ]
  },
  blocks: [
    {
      id: '1zpMEbbcnB7Xv3ObeU5MrR44woG',
      $index: 'a0',
      type: 'A',
      field1: 'A'
    },
    {
      id: '205y6G9Y8CYQr9awIrEZUxAvdCW',
      $index: 'a1',
      type: 'A',
      field1: 'B'
    }
  ]
}

const Doc = type('Doc', {
  title: text('Title', {multiline: true}),
  path: path('Path'),
  body: richText('Body', {
    blocks: createSchema({
      CodeBlock: type('CodeBlock', {
        code: text('Code', {multiline: true})
      }),
      Inception: type('Inception', {
        wysiwyg: richText('Wysiwyg')
      })
    })
  }),
  blocks: list('List test', {
    schema: createSchema({
      A: type('Type A', {
        field1: text('Field 1')
      }),
      Wysiwyg: type('Wysiwyg', {
        field1: richText('Field 2')
      })
    })
  })
})

test('size comparison', () => {
  const yDoc = docFromEntry(Doc, entry)
  const doc = Y.encodeStateAsUpdate(yDoc)
  console.log('json size: ' + JSON.stringify(entry).length)
  console.log('ydoc size: ' + doc.length)
})

test.run()
