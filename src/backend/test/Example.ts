import {page, root, type, workspace} from 'alinea/core'
import {createTestCMS} from 'alinea/core/driver/TestDriver'
import {path, tab, tabs, text} from 'alinea/input'

const TypeA = type('Type', {
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

const TypeB = type('TypeB', {
  title: text('Title'),
  path: path('Path'),
  name: text('name'),
  [type.meta]: {
    isContainer: true
  }
})

const main = workspace('Main', {
  pages: root('Pages', {
    entry1: page(TypeA({title: 'Test title'})),
    entry2: page(TypeA({title: 'Entry 2'}), {
      entry3: page(TypeB({title: 'Entry 3'}))
    }),
    [root.meta]: {
      contains: ['TypeA']
    }
  }),
  media: root('Media', {
    [root.meta]: {
      contains: ['TypeA']
    }
  }),
  [workspace.meta]: {
    source: '.'
  }
})

export const example = createTestCMS({
  schema: {TypeA, TypeB},
  workspaces: {main}
})
