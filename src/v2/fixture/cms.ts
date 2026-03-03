import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'

const Page = Config.document('Page', {
  contains: ['Page', 'Folder'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    summary: Field.text('Summary')
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
