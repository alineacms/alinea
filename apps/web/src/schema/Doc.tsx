import {Config, Field} from 'alinea'
import {docsEntryUrl} from './DocsUrl'
import {bodyField} from './fields/BodyField'

export const Doc = Config.document('Doc', {
  entryUrl: docsEntryUrl,
  fields: {
    navigationTitle: Field.text('Title in navigation', {
      searchable: true
    }),
    body: bodyField()
  }
})
