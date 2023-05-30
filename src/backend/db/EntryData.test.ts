import {entryData} from 'alinea/backend/db/EntryData.js'
import {type} from 'alinea/core'
import {richText} from 'alinea/input/richtext/RichTextField'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const typeWithRichText = type('Test', {
  text: richText('My rich text field')
})

const exampleData = [
  {
    type: 'heading',
    textAlign: 'left',
    level: 1,
    content: [
      {
        type: 'text',
        text: 'Introduction'
      }
    ]
  },
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: 'Alinea is an open source headless CMS written in Typescript.'
      }
    ]
  },
  {
    type: 'bulletList',
    content: [
      {
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            textAlign: 'left',
            content: [
              {
                type: 'text',
                text: 'Content is stored in flat files and can be committed to a git repository'
              }
            ]
          }
        ]
      },
      {
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            textAlign: 'left',
            content: [
              {
                type: 'text',
                text: 'Content is queryable through an in-memory SQLite database, zero network overhead'
              }
            ]
          }
        ]
      },
      {
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            textAlign: 'left',
            content: [
              {
                type: 'text',
                text: 'Content is fully typed when using Typescript'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: "It can be installed as a single NPM package that provides a CLI which let's you get going without setting up databases, environments or any other services. "
      }
    ]
  },
  {
    id: '0c3ZcIuX3S5DDMhK910DE',
    type: 'ChapterLinkBlock',
    link: [
      {
        id: 'pQQ6PFuITK3HiaihU-4ax',
        index: 'a0',
        type: 'entry',
        entry: '20580nQzbOBR3Lt4kIdxyRGglc6'
      }
    ]
  },
  {
    type: 'heading',
    textAlign: 'left',
    level: 2,
    content: [
      {
        type: 'text',
        text: 'Configuring the schema'
      }
    ]
  },
  {
    type: 'paragraph',
    textAlign: 'left',
    content: [
      {
        type: 'text',
        text: 'The content schema is configured in a central config file with '
      },
      {
        type: 'text',
        text: 'types',
        marks: [
          {
            type: 'link',
            attrs: {
              'data-id': 'FXVYc0oWLl9w11PQFvH0W',
              'data-entry': '267QuOShP41WnFxQFOcHZQoCsla',
              href: null,
              title: null
            }
          }
        ]
      },
      {
        type: 'text',
        text: '. A type holds different fields — alinea ships with a lot of preconfigured field types that can be added to by creating custom fields. '
      }
    ]
  }
]

test('parse links for rich text fields', () => {
  const parsed = entryData(typeWithRichText, {text: exampleData})
  assert.equal(parsed.text.linked, ['267QuOShP41WnFxQFOcHZQoCsla'])
})

test.run()
