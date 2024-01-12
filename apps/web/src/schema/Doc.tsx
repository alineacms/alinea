import alinea from 'alinea'
import {bodyField} from './blocks/BodyField'

export const Doc = alinea.document('Doc', {
  navigationTitle: alinea.text('Title in navigation'),
  body: bodyField(),
  extraField: bodyField()
})
