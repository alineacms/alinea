import {createCMS} from '#/core.js'
import type {Infer} from '#/core/Infer.js'
import {ListRow} from '#/core/ListRow.js'
import {BlockNode, Node} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import {Config, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {suite} from '@alinea/suite'
import {localiser} from './Localiser.js'

const test = suite(import.meta)

const localise = localiser({
  locales: ['en', 'de', 'fr'],
  fallback(requested) {
    if (requested === 'fr') return ['de', 'en']
    return ['en']
  }
})

const Article = Config.type('Article', {
  fields: {
    localisedTitle: localise(Field.text('Localised title')),
    localisedCta: localise(
      Field.url('Localised CTA', {
        fields: {
          label: localise(Field.text('Link label'))
        }
      })
    ),
    details: Field.object('Details', {
      fields: {
        summary: localise(Field.text('Summary'))
      }
    }),
    blocks: Field.list('Blocks', {
      schema: {
        block: Config.type('Block', {
          fields: {
            summary: localise(Field.text('Block summary'))
          }
        })
      }
    }),
    body: Field.richText('Body', {
      schema: {
        Callout: Config.type('Callout', {
          fields: {
            headline: localise(Field.text('Headline'))
          }
        })
      }
    }),
    nested: Field.object('Nested', {
      fields: {
        items: Field.list('Items', {
          schema: {
            item: Config.type('Item', {
              fields: {
                body: Field.richText('Item body', {
                  schema: {
                    Note: Config.type('Note', {
                      fields: {
                        label: localise(Field.text('Note label'))
                      }
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  }
})

function assertQueryValue(
  value: Pick<Infer<typeof Article>, 'localisedTitle'>
) {
  const title: string = value.localisedTitle
  return title
}

const mainWorkspace = Config.workspace('Main', {
  source: 'content/main',
  roots: {
    pages: Config.root('Pages', {
      i18n: {locales: ['en', 'de', 'fr']},
      contains: ['Article']
    })
  }
})

const cms = createCMS({
  schema: {Article},
  workspaces: {main: mainWorkspace}
})

async function createResolver() {
  return createEntryResolver(cms.config, [
    {
      id: 'article',
      type: 'Article',
      index: 'a0',
      locale: 'de',
      data: {
        localisedTitle: {
          en: 'Hello',
          de: 'Hallo',
          fr: ''
        },
        localisedCta: {
          en: {
            _id: 'en-link',
            _type: 'url',
            _url: 'https://example.com/en',
            _title: 'English',
            _target: '',
            label: {
              en: 'English link',
              de: 'Deutscher Link',
              fr: ''
            }
          },
          de: {
            _id: 'de-link',
            _type: 'url',
            _url: 'https://example.com/de',
            _title: 'Deutsch',
            _target: '_blank',
            label: {
              en: 'English link',
              de: 'Deutscher Link',
              fr: ''
            }
          }
        },
        details: {
          summary: {
            en: 'English summary',
            de: 'Deutsche Zusammenfassung',
            fr: ''
          }
        },
        blocks: [
          {
            [ListRow.id]: 'block-1',
            [ListRow.type]: 'block',
            [ListRow.index]: 'a0',
            summary: {
              en: 'English block',
              de: 'Deutscher Block',
              fr: ''
            }
          }
        ],
        body: [
          {
            [Node.type]: 'paragraph',
            content: [{[Node.type]: 'text', text: 'Intro'}]
          },
          {
            [Node.type]: 'Callout',
            [BlockNode.id]: 'callout-1',
            headline: {
              en: 'English callout',
              de: 'Deutscher Callout',
              fr: ''
            }
          }
        ],
        nested: {
          items: [
            {
              [ListRow.id]: 'item-1',
              [ListRow.type]: 'item',
              [ListRow.index]: 'a0',
              body: [
                {
                  [Node.type]: 'Note',
                  [BlockNode.id]: 'note-1',
                  label: {
                    en: 'English note',
                    de: 'Deutsche Notiz',
                    fr: ''
                  }
                }
              ]
            }
          ]
        }
      }
    },
    {
      id: 'article',
      type: 'Article',
      index: 'a0',
      locale: 'fr',
      data: {
        localisedTitle: {
          en: 'Hello',
          de: 'Hallo',
          fr: ''
        },
        localisedCta: {
          en: {
            _id: 'en-link',
            _type: 'url',
            _url: 'https://example.com/en',
            _title: 'English',
            _target: '',
            label: {
              en: 'English link',
              de: 'Deutscher Link',
              fr: ''
            }
          },
          de: {
            _id: 'de-link',
            _type: 'url',
            _url: 'https://example.com/de',
            _title: 'Deutsch',
            _target: '_blank',
            label: {
              en: 'English link',
              de: 'Deutscher Link',
              fr: ''
            }
          }
        },
        details: {
          summary: {
            en: 'English summary',
            de: 'Deutsche Zusammenfassung',
            fr: ''
          }
        },
        blocks: [
          {
            [ListRow.id]: 'block-1',
            [ListRow.type]: 'block',
            [ListRow.index]: 'a0',
            summary: {
              en: 'English block',
              de: 'Deutscher Block',
              fr: ''
            }
          }
        ],
        body: [
          {
            [Node.type]: 'paragraph',
            content: [{[Node.type]: 'text', text: 'Intro'}]
          },
          {
            [Node.type]: 'Callout',
            [BlockNode.id]: 'callout-1',
            headline: {
              en: 'English callout',
              de: 'Deutscher Callout',
              fr: ''
            }
          }
        ],
        nested: {
          items: [
            {
              [ListRow.id]: 'item-1',
              [ListRow.type]: 'item',
              [ListRow.index]: 'a0',
              body: [
                {
                  [Node.type]: 'Note',
                  [BlockNode.id]: 'note-1',
                  label: {
                    en: 'English note',
                    de: 'Deutsche Notiz',
                    fr: ''
                  }
                }
              ]
            }
          ]
        }
      }
    }
  ])
}

test('localised field query value is the underlying field value', () => {
  test.is(assertQueryValue({localisedTitle: 'Hello'}), 'Hello')
})

test('localised field selects the link resolver locale', async () => {
  const {resolver} = await createResolver()
  const title = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.localisedTitle
  })
  test.is(title, 'Hallo')
})

test('localised field falls back when the requested value is unavailable', async () => {
  const {resolver} = await createResolver()
  const row = await resolver.resolve({
    first: true,
    locale: 'fr',
    type: Article,
    select: {
      title: Article.localisedTitle
    }
  })
  test.equal(row, {title: 'Hallo'})
})

test('localised field query value propagates inside object fields', async () => {
  const {resolver} = await createResolver()
  const details = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.details
  })
  test.equal(details, {summary: 'Deutsche Zusammenfassung'})
})

test('localised field query value propagates inside list fields', async () => {
  const {resolver} = await createResolver()
  const blocks = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.blocks
  })
  test.equal(blocks, [
    {
      _id: 'block-1',
      _type: 'block',
      _index: 'a0',
      summary: 'Deutscher Block'
    }
  ])
})

test('localised field query value propagates inside rich text fields', async () => {
  const {resolver} = await createResolver()
  const body = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.body
  })
  test.equal(body, [
    {
      _type: 'paragraph',
      content: [{_type: 'text', text: 'Intro'}]
    },
    {
      _type: 'Callout',
      _id: 'callout-1',
      headline: 'Deutscher Callout'
    }
  ])
})

test('localised field query value propagates through mixed nesting', async () => {
  const {resolver} = await createResolver()
  const nested = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.nested
  })
  test.equal(nested, {
    items: [
      {
        _id: 'item-1',
        _type: 'item',
        _index: 'a0',
        body: [
          {
            _type: 'Note',
            _id: 'note-1',
            label: 'Deutsche Notiz'
          }
        ]
      }
    ]
  })
})

test('localised field applies underlying field postprocess before replacing', async () => {
  const {resolver} = await createResolver()
  const link = await resolver.resolve({
    first: true,
    locale: 'de',
    type: Article,
    select: Article.localisedCta
  })
  test.equal(link, {
    _id: 'de-link',
    _type: 'url',
    _url: 'https://example.com/de',
    _title: 'Deutsch',
    _target: '_blank',
    href: 'https://example.com/de',
    url: 'https://example.com/de',
    title: 'Deutsch',
    target: '_blank',
    fields: {
      label: 'Deutscher Link'
    }
  })
})

test('localised fields use defaults when source value is missing', () => {
  const Page = Config.type('Page', {
    fields: {
      title: localise(Field.text('Title', {searchable: true}))
    }
  })

  test.is(Type.searchableText(Page, {}), '')
})

test('localised object defaults do not share nested references', () => {
  const Page = Config.type('Page', {
    fields: {
      seo: localise(
        Field.object('SEO', {
          fields: {
            title: Field.text('Title')
          }
        })
      )
    }
  })
  const value = Type.initialValue(Page).seo as {
    en: {title: string}
    de: {title: string}
  }

  test.ok(value.en !== value.de)
  value.en.title = 'English'
  test.is(value.de.title, '')
})
