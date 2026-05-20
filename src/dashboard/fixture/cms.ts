import {createCMS} from '#/core.js'
import {Config, Field} from '#/index.js'
import {
  IcOutlineGridView,
  IcRoundHistory,
  IcRoundTranslate,
  MiLayers
} from '../icons.js'

const Page = Config.document('Page', {
  contains: ['Page', 'Folder'],
  fields: {
    title: Field.text('Title', {width: 0.5}),
    path: Field.path('Path', {width: 0.5}),
    summary: Field.text('Summary', {
      multiline: true,
      placeholder: 'Write a short summary'
    }),
    intro: Field.richText('Intro', {
      searchable: true
    }),
    codeSample: Field.code('Code sample', {
      language: 'ts'
    }),
    body: Field.richText('Body', {
      schema: {
        Cta: Config.type('Call to action', {
          fields: {
            title: Field.text('Title'),
            text: Field.text('Text', {
              multiline: true,
              placeholder: 'Write a short prompt'
            }),
            actionCode: Field.code('Action code', {
              language: 'ts'
            }),
            variant: Field.select('Variant', {
              options: {
                primary: 'Primary',
                secondary: 'Secondary',
                subtle: 'Subtle'
              },
              initialValue: 'primary'
            }),
            details: Field.richText('Details', {
              schema: {
                Note: Config.type('Note', {
                  fields: {
                    text: Field.text('Text', {
                      multiline: true,
                      placeholder: 'Add a nested note'
                    })
                  }
                })
              }
            }),
            featured: Field.check('Featured')
          }
        }),
        Quote: Config.type('Quote', {
          fields: {
            quote: Field.text('Quote', {
              multiline: true,
              placeholder: 'Add a quote'
            }),
            attribution: Field.text('Attribution')
          }
        })
      },
      searchable: true,
      enableTables: true
    }),
    notes: Field.richText('Notes', {
      searchable: true
    }),
    featured: Field.check('Featured', {
      width: 0.5,
      description: 'Highlight on overview pages',
      initialValue: true
    }),
    category: Field.select('Category', {
      width: 0.5,
      options: {
        docs: 'Docs',
        news: 'News',
        release: 'Release notes'
      },
      initialValue: 'docs'
    }),
    wordCount: Field.number('Word count', {
      width: 1 / 3,
      minValue: 0,
      step: 10
    }),
    publishDate: Field.date('Publish date', {
      width: 1 / 3
    }),
    publishTime: Field.time('Publish time', {
      width: 1 / 3,
      step: 900
    }),
    relatedLink: Field.link('Related link'),
    resources: Field.link.multiple('Resources'),
    inner: Field.object('Testje', {
      fields: {
        a: Field.text('field A'),
        b: Field.text('field B')
      }
    }),
    sections: Field.list('Sections', {
      schema: {
        callout: Config.type('Callout', {
          fields: {
            heading: Field.text('Heading'),
            text: Field.text('Text', {
              multiline: true,
              placeholder: 'Write section copy'
            }),
            snippet: Field.code('Snippet', {
              language: 'ts'
            })
          }
        })
      }
    })
  }
})

const Folder = Config.document('Folder', {
  contains: ['Page', 'Folder'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

const simple = Config.workspace('Simple', {
  source: 'content/simple',
  icon: IcOutlineGridView,
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media({
      i18n: {
        locales: ['en', 'fr', 'de']
      }
    })
  }
})

const nested = Config.workspace('Deeply nested', {
  source: 'content/nested',
  icon: MiLayers,
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media()
  }
})

const many = Config.workspace('Many entries', {
  source: 'content/many',
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media()
  }
})

const i18n = Config.workspace('Multi language', {
  source: 'content/i18n',
  icon: IcRoundTranslate,
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true,
      i18n: {
        locales: ['en', 'fr', 'de']
      }
    }),
    media: Config.media()
  }
})

const statuses = Config.workspace('Statuses', {
  source: 'content/statuses',
  icon: IcRoundHistory,
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media()
  }
})

export const cms = createCMS({
  enableDrafts: true,
  schema: {Page, Folder},
  workspaces: {
    simple,
    nested,
    many,
    i18n,
    statuses
  }
})
