import {suite} from '@alinea/suite'
import {createConfig} from '../Config.js'
import {root} from '../Root.js'
import {workspace, type MediaUrlMeta} from '../Workspace.js'
import {MediaLocation} from './MediaLocation.js'

const test = suite(import.meta)

test('maps media locations between storage and entry data', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        mediaDir: 'public/media',
        roots: {media: root('Media')}
      })
    }
  })

  test.is(MediaLocation.directory(config, 'main'), 'public/media')
  test.is(
    MediaLocation.storagePath(config, 'main', '/upload-id.jpg'),
    'public/media/upload-id.jpg'
  )
  test.is(
    MediaLocation.entryLocation(config, 'main', 'public/media/upload-id.jpg'),
    '/upload-id.jpg'
  )
  test.is(
    MediaLocation.publicUrl(config, {
      entryUrl: '/example',
      extension: '.jpg',
      location: '/upload-id.jpg',
      path: 'example',
      root: 'media',
      workspace: 'main'
    }),
    '/upload-id.jpg'
  )
})

test('resolves the public URL from logical media details', () => {
  let received: MediaUrlMeta | undefined
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        mediaUrl(meta) {
          received = meta
          return `/images/${[...meta.parentPaths, meta.path].join('/')}${meta.extension}`
        },
        roots: {media: root('Media')}
      })
    }
  })

  const url = MediaLocation.publicUrl(config, {
    entryUrl: '/library/nested/example',
    extension: '.jpg',
    location: '/media/upload-id.jpg',
    path: 'example',
    root: 'media',
    workspace: 'main'
  })

  test.is(url, '/images/library/nested/example.jpg')
  test.equal(received, {
    extension: '.jpg',
    location: '/media/upload-id.jpg',
    parentPaths: ['library', 'nested'],
    path: 'example',
    root: 'media',
    workspace: 'main'
  })
})

test('resolves a media entry URL from its stored data', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        mediaUrl: ({path, extension}) => `/files/${path}${extension}`,
        roots: {media: root('Media')}
      })
    }
  })
  const entry = {
    entryUrl: '/example',
    path: 'example',
    root: 'media',
    workspace: 'main'
  }

  test.is(
    MediaLocation.entryUrl(config, {
      ...entry,
      data: {extension: '.pdf', location: '/upload-id.pdf'}
    }),
    '/files/example.pdf'
  )
  test.is(MediaLocation.entryUrl(config, {...entry, data: {}}), '/example')
})
