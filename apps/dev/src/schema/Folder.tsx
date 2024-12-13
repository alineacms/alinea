import {Config, Field} from 'alinea'
import {Page} from './Page.js'
import {LinkFields} from './example/LinkFields.js'

export const Folder = Config.type('Folder', {
  contains: [Page, LinkFields],
  fields: {
    title: Field.text('Title', {
      width: 0.5
    }),
    path: Field.path('Path', {
      width: 0.5
    })
  }
})
