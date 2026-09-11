import {suite} from '@alinea/suite'
import {createConfig} from '../Config.js'
import {root} from '../Root.js'
import {workspace} from '../Workspace.js'
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
      extension: '.jpg',
      location: '/upload-id.jpg',
      parentPaths: [],
      path: 'example',
      root: 'media',
      workspace: 'main'
    }),
    '/admin/file/example.jpg'
  )
})

test('preserves locations when no media directory is configured', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        roots: {media: root('Media')}
      })
    }
  })

  test.is(MediaLocation.sourceUrl(config, 'main', '/stored.jpg'), '/stored.jpg')
})

test('strips an absolute media directory from relative provider locations', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        mediaDir: '/public/media',
        roots: {media: root('Media')}
      })
    }
  })

  test.is(
    MediaLocation.entryLocation(config, 'main', 'public/media/upload-id.jpg'),
    '/upload-id.jpg'
  )
})

test('versions media urls without changing their canonical path', () => {
  test.is(
    MediaLocation.versionedUrl('/admin/file/image.jpg', 'hash/value'),
    '/admin/file/image.jpg?v=hash%2Fvalue'
  )
  test.is(
    MediaLocation.versionedUrl(
      '/admin/file/image.jpg?size=large#preview',
      'v2'
    ),
    '/admin/file/image.jpg?size=large&v=v2#preview'
  )
})

test('resolves nested media paths below the Alinea file route', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        roots: {media: root('Media')}
      })
    }
  })

  const url = MediaLocation.publicUrl(config, {
    extension: '.jpg',
    location: '/media/upload-id.jpg',
    parentPaths: ['library', 'nested'],
    path: 'example',
    root: 'media',
    workspace: 'main'
  })

  test.is(url, '/admin/file/library/nested/example.jpg')
})

test('resolves a media entry URL from its stored data', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        roots: {media: root('Media')}
      })
    }
  })
  const entry = {
    defaultUrl: '/example',
    parentPaths: [],
    path: 'example',
    root: 'media',
    workspace: 'main'
  }

  test.is(
    MediaLocation.entryUrl(config, {
      ...entry,
      data: {extension: '.pdf', location: '/upload-id.pdf'}
    }),
    '/admin/file/example.pdf'
  )
  test.is(MediaLocation.entryUrl(config, {...entry, data: {}}), '/example')
})
