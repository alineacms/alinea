import {Config, Field} from 'alinea'
import {LinkFields} from './example/LinkFields'
import {Page} from './Page'

export const Folder = Config.document('Folder', {
  contains: ['Folder', Page, LinkFields],
  fields: {
    childrenLink: Field.entry('Pick children', {
      help: `Show only children of the current entry`,
      pickChildren: true
    })
  }
})
