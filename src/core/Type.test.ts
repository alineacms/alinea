import {suite} from '@alinea/suite'
import {Field} from '#/core/Field.js'
import {Type, type} from '#/core/Type.js'
import {list, richText, text} from '#/field.js'
import {ElementNode, Mark, Node, type TextDoc, TextNode} from './TextDoc.js'
import {ListRow} from './ListRow.js'

const Test = type('Test', {
  fields: {
    a: text('A'),
    b: text('B', {searchable: true}),
    list: list('List', {
      schema: {
        Sub: type('Sub', {
          fields: {
            c: text('C'),
            d: text('D', {searchable: true}),
            body: richText('Body')
          }
        })
      }
    }),
    rich: richText('Rich', {searchable: true})
  }
})

const value = {
  a: 'A',
  b: 'B',
  list: [
    {
      [ListRow.type]: 'Sub',
      [ListRow.id]: '123',
      _anchor: 'block-anchor',
      _label: 'Block anchor',
      c: 'C',
      d: 'D',
      body: [
        {
          [Node.type]: 'heading',
          _anchor: 'nested-heading',
          [ElementNode.content]: [
            {[Node.type]: 'text', [TextNode.text]: 'Nested heading'}
          ]
        }
      ]
    }
  ],
  rich: [
    {
      [Node.type]: 'heading',
      _anchor: 'rich-heading',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Rich text'
        }
      ]
    },
    {
      [Node.type]: 'paragraph',
      [ElementNode.content]: [
        {
          [Node.type]: 'text',
          [TextNode.text]: 'Lorem ipsum',
          [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'inline-anchor'}]
        }
      ]
    }
  ]
}

const test = suite(import.meta)

test('Searchable text', () => {
  const text = Type.searchableText(Test, value)
  test.is(text, 'B D Rich text Lorem ipsum')
})

test('Anchors', () => {
  const anchors = Type.anchors(Test, value)
  test.equal(
    anchors.map(anchor => ({
      id: anchor.id,
      fieldPath: anchor.fieldPath,
      fieldLabel: anchor.fieldLabel
    })),
    [
      {
        id: 'block-anchor',
        fieldPath: 'list.123.block-anchor',
        fieldLabel: 'List'
      },
      {
        id: 'nested-heading',
        fieldPath: 'list.123.body.0.nested-heading',
        fieldLabel: 'Body'
      },
      {
        id: 'rich-heading',
        fieldPath: 'rich.0.rich-heading',
        fieldLabel: 'Rich'
      },
      {
        id: 'inline-anchor',
        fieldPath: 'rich.1.content.0.inline-anchor',
        fieldLabel: 'Rich'
      }
    ]
  )
})

test('Normalizes anchors across every field in an entry', () => {
  const Anchored = type('Anchored', {
    fields: {
      intro: richText('Intro'),
      sections: list('Sections', {
        schema: {
          Section: type('Section', {fields: {title: text('Title')}})
        }
      }),
      outro: richText('Outro')
    }
  })
  const duplicateHeading = {
    [Node.type]: 'heading',
    _anchor: 'same',
    [ElementNode.content]: [
      {
        [Node.type]: 'text',
        [TextNode.text]: 'Same',
        [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'same'}]
      }
    ]
  }
  const input = {
    intro: [
      duplicateHeading,
      {
        [Node.type]: 'paragraph',
        [ElementNode.content]: [
          {
            [Node.type]: 'text',
            [TextNode.text]: 'First inline',
            [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'same'}]
          },
          {
            [Node.type]: 'text',
            [TextNode.text]: ' separator '
          },
          {
            [Node.type]: 'text',
            [TextNode.text]: 'Second inline',
            [TextNode.marks]: [{[Mark.type]: 'anchor', id: 'same'}]
          }
        ]
      }
    ],
    sections: [
      {
        [ListRow.type]: 'Section',
        [ListRow.id]: 'first',
        _label: 'Same'
      },
      {
        [ListRow.type]: 'Section',
        [ListRow.id]: 'second',
        _anchor: 'same'
      }
    ],
    outro: [duplicateHeading]
  }

  const initialized = Type.withInitialValue(Anchored, input)
  const initializedIntro = initialized.intro as TextDoc
  const initializedHeading = initializedIntro[0]
  const initializedHeadingText = Node.isElement(initializedHeading)
    ? initializedHeading.content?.[0]
    : undefined
  test.is(
    initializedHeadingText && Node.isText(initializedHeadingText)
      ? initializedHeadingText.marks
      : undefined,
    undefined
  )
  test.equal(
    Type.anchors(Anchored, initialized).map(anchor => anchor.id),
    ['same', 'same-2', 'same-3', 'same-4', 'same-5', 'same-6']
  )
  test.equal(
    Type.anchors(
      Anchored,
      Type.beforeSave(Anchored, input, {
        action: 'update',
        now: new Date(0)
      })
    ).map(anchor => anchor.id),
    ['same', 'same-2', 'same-3', 'same-4', 'same-5', 'same-6']
  )
})

test('List block settings are initialized and processed as a nested record', async () => {
  const Block = type('Block', {
    fields: {
      body: text('Body')
    },
    settings: {
      eyebrow: text('Eyebrow', {initialValue: 'Default', searchable: true}),
      notes: richText('Notes')
    }
  })
  const Page = type('Page', {
    fields: {
      blocks: list('Blocks', {schema: {Block}})
    }
  })
  const input = {
    blocks: [
      {
        [ListRow.id]: 'block',
        [ListRow.type]: 'Block',
        body: 'Body',
        settings: {
          notes: [
            {
              [Node.type]: 'heading',
              _anchor: 'settings-heading',
              [ElementNode.content]: [
                {[Node.type]: 'text', [TextNode.text]: 'Settings heading'}
              ]
            }
          ]
        }
      }
    ]
  }

  const initialized = Type.withInitialValue(Page, input)
  const [block] = initialized.blocks as Array<Record<string, unknown>>
  test.equal(block.settings, {
    eyebrow: 'Default',
    notes: input.blocks[0].settings.notes
  })
  test.is(Type.searchableText(Page, initialized), 'Default')
  const queried = await Field.queryValue(Page.blocks, initialized.blocks, {
    resolveLinks: async () => []
  } as never)
  test.is(queried[0].settings.eyebrow, 'Default')
  test.equal(
    Type.anchors(Page, initialized).map(anchor => ({
      id: anchor.id,
      fieldPath: anchor.fieldPath
    })),
    [
      {
        id: 'settings-heading',
        fieldPath: 'blocks.block.settings.notes.0.settings-heading'
      }
    ]
  )
  test.is(Type.settings(Block) !== undefined, true)
})
