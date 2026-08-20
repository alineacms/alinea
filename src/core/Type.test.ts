import {suite} from '@alinea/suite'
import {Type, type} from '#/core/Type.js'
import {link, list, richText, select, text} from '#/field.js'
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

test('derives list anchors from labels', () => {
  const Labeled = type('Labeled', {
    fields: {
      items: list('Items', {
        schema: {
          Item: type('Item', {fields: {title: text('Title')}})
        }
      })
    }
  })
  const value = {
    items: [
      {
        [ListRow.type]: 'Item',
        [ListRow.id]: 'item-1',
        _label: 'Learn more about our technology',
        title: 'Technology'
      }
    ]
  }

  const initialized = Type.withInitialValue(Labeled, value)
  test.equal(initialized, {
    items: [
      {
        [ListRow.type]: 'Item',
        [ListRow.id]: 'item-1',
        _label: 'Learn more about our technology',
        _anchor: 'learn-more-about-our-technology',
        title: 'Technology'
      }
    ]
  })
})

test('does not derive link anchors from labels', () => {
  const Linked = type('Linked', {
    fields: {
      links: link.multiple('Links')
    }
  })
  const value = {
    links: [
      {
        [ListRow.type]: 'entry',
        [ListRow.id]: 'link-1',
        _label: 'Learn more about our technology',
        _entry: 'entry-1'
      }
    ]
  }

  const initialized = Type.withInitialValue(Linked, value)
  const saved = Type.beforeSave(Linked, value, {
    action: 'update',
    now: new Date(0)
  })
  const anchoredValue = {
    links: [
      {
        ...value.links[0],
        _anchor: 'details'
      }
    ]
  }

  test.equal(initialized, value)
  test.equal(saved, value)
  test.equal(Type.anchors(Linked, anchoredValue), [])
  test.equal(
    Type.beforeSave(Linked, anchoredValue, {
      action: 'update',
      now: new Date(0)
    }),
    anchoredValue
  )
})

test('initializes missing fields in legacy list rows', () => {
  const Row = type('Row', {
    fields: {
      variant: select('Variant', {
        options: {primary: 'Primary', secondary: 'Secondary'},
        initialValue: 'primary'
      })
    }
  })
  const Document = type('Document', {
    fields: {
      rows: list('Rows', {schema: {Row}})
    }
  })

  test.equal(
    Type.withInitialValue(Document, {
      rows: [{_type: 'Row', _id: 'legacy', _index: 'a0'}]
    }),
    {
      rows: [
        {
          _type: 'Row',
          _id: 'legacy',
          _index: 'a0',
          variant: 'primary'
        }
      ]
    }
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
