import {page, root, type, workspace} from 'alinea/core'
import {createTestCMS} from 'alinea/core/driver/TestDriver'
import {createMediaRoot} from 'alinea/core/media/MediaRoot'
import {MediaFile, MediaLibrary} from 'alinea/core/media/MediaSchema'
import {path, tab, tabs, text} from 'alinea/input'

export function createExample() {
  const Page = type('Type', {
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

  const Container = type('TypeB', {
    title: text('Title'),
    path: path('Path'),
    name: text('name'),
    [type.meta]: {
      isContainer: true
    }
  })

  const main = workspace('Main', {
    pages: root('Pages', {
      entry1: page(Page({title: 'Test title'})),
      entry2: page(Container({title: 'Entry 2'}), {
        entry3: page(Page({title: 'Entry 3'}))
      }),
      [root.meta]: {
        contains: ['TypeA']
      }
    }),
    media: createMediaRoot({
      dir: page(MediaLibrary({title: 'Media folder'})),
      'file1.png': page(
        MediaFile({
          title: 'File 1',
          path: 'file1.png',
          extension: '.png',
          size: 1000,
          hash: 'hash1'
        })
      )
    }),
    [workspace.meta]: {
      source: '.'
    }
  })

  return createTestCMS({
    schema: {Page, Container},
    workspaces: {main}
  })
}
