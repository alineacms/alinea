import {Config, Field} from 'alinea'
import {docsEntryUrl} from './DocsUrl'
import {bodyField} from './fields/BodyField'

export const Docs = Config.document('Docs', {
  contains: ['Doc', 'Docs'],
  entryUrl: docsEntryUrl,
  fields: {
    navigationTitle: Field.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
