import {type} from 'alinea/core'
import {path, tab, tabs, text} from 'alinea/input'

export const TypeWithTabs = type('Type', {
  title: text('Title'),
  path: path('Path'),
  ...tabs(
    tab('Tab 1', {
      name: path('Name')
    }),
    tab('Tab 2', {
      name: text('Name'),
      name2: text('Name')
    })
  ),
  [type.meta]: {
    isContainer: true
  }
})
