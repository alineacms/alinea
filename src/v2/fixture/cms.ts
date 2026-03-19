import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'

const Page = Config.document('Page', {
  contains: ['Page', 'Folder'],
  fields: {
    title: Field.text('Title', {width: 0.5}),
    path: Field.path('Path', {width: 0.5}),
    summary: Field.text('Summary', {
      multiline: true,
      placeholder: 'Write a short summary'
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
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media()
  }
})

const nested = Config.workspace('Deeply nested', {
  source: 'content/nested',
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
  roots: {
    pages: Config.root('Pages', {
      contains: ['Page', 'Folder'],
      openByDefault: true
    }),
    media: Config.media()
  }
})

export const cms = createCMS({
  schema: {Page, Folder},
  workspaces: {
    simple,
    nested,
    many,
    i18n,
    statuses
  }
})
