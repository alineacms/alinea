import {suite} from '@alinea/suite'
import {Type, type} from '#/core/Type.js'
import {entry, image, link, list, richText, select, text} from '#/field.js'
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

test('Localizes entry links to translated targets', () => {
  const Row = type('Row', {fields: {link: link('Link')}})
  const Linked = type('Linked', {
    fields: {
      single: entry('Single'),
      many: link.multiple('Many', {fields: {related: entry('Related')}}),
      rows: list('Rows', {schema: {Row}}),
      picture: image('Picture'),
      body: richText('Body')
    }
  })
  const input = {
    single: {_type: 'entry', _id: 'single', _entry: 'news', _locale: 'nl'},
    many: [
      {
        _type: 'entry',
        _id: 'many-1',
        _index: 'a0',
        _entry: 'news',
        _locale: 'nl',
        related: {_type: 'entry', _id: 'related', _entry: 'news'}
      },
      {
        _type: 'entry',
        _id: 'many-2',
        _index: 'a1',
        _entry: 'about',
        _locale: 'nl'
      }
    ],
    rows: [
      {
        _type: 'Row',
        _id: 'row-1',
        _index: 'a0',
        link: {_type: 'entry', _id: 'link', _entry: 'news', _locale: 'nl'}
      }
    ],
    picture: {_type: 'image', _id: 'picture', _entry: 'media-1'},
    body: [
      {
        [Node.type]: 'paragraph',
        [ElementNode.content]: [
          {
            [Node.type]: 'text',
            [TextNode.text]: 'Nieuws & events',
            [TextNode.marks]: [
              {
                [Mark.type]: 'link',
                _id: 'mark-1',
                _link: 'entry',
                _entry: 'news',
                _locale: 'nl'
              },
              {
                [Mark.type]: 'link',
                _id: 'mark-2',
                _link: 'file',
                _entry: 'media-1'
              }
            ]
          }
        ]
      }
    ]
  }
  const snapshot = structuredClone(input)

  test.equal(
    Type.references(Linked, input)
      .filter(reference => reference.linkType === 'entry')
      .map(reference => reference.targetId)
      .sort(),
    ['about', 'news', 'news', 'news', 'news', 'news']
  )

  const localized = Type.localizeLinks(Linked, input, {
    locale: 'fr',
    entryIds: new Set(['news', 'media-1'])
  })
  test.equal(localized, {
    single: {...input.single, _locale: 'fr'},
    many: [
      {
        ...input.many[0],
        _locale: 'fr',
        related: {...input.many[0].related, _locale: 'fr'}
      },
      input.many[1]
    ],
    rows: [{...input.rows[0], link: {...input.rows[0].link, _locale: 'fr'}}],
    picture: input.picture,
    body: [
      {
        [Node.type]: 'paragraph',
        [ElementNode.content]: [
          {
            ...input.body[0].content[0],
            [TextNode.marks]: [
              {...input.body[0].content[0].marks[0], _locale: 'fr'},
              input.body[0].content[0].marks[1]
            ]
          }
        ]
      }
    ]
  })
  test.equal(input, snapshot)
  const many = localized.many as typeof input.many
  test.is(many[1], input.many[1])
  test.is(localized.picture, input.picture)
  test.is(
    Type.localizeLinks(Linked, input, {
      locale: 'fr',
      entryIds: new Set(['missing'])
    }),
    input
  )
})
