import {Config, Field} from 'alinea'
import {Page} from './Page.js'
import {LinkFields} from './example/LinkFields.js'

export const Folder = Config.document('Folder', {
  contains: ['Folder', Page, LinkFields],
  fields: {
    childrenLink: Field.entry('Pick children', {
      help: `Show only children of the current entry`,
      pickChildren: true
    })
  }
})
