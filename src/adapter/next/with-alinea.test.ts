import {suite} from '@alinea/suite'
import {withAlinea} from './with-alinea.js'

const test = suite(import.meta)

test('inlines CLI routing settings into the Next config', () => {
  const config = withAlinea({
    env: {
      EXISTING_VALUE: 'preserved',
      ALINEA_ADMIN_PATH: 'admin'
    }
  })

  test.equal(config.env, {
    EXISTING_VALUE: 'preserved',
    ALINEA_ADMIN_PATH: '/admin',
    ALINEA_HANDLER_URL: '/api/cms'
  })
})

test('routes files through the handler and allows versioned images', async () => {
  const config = withAlinea({
    env: {
      ALINEA_ADMIN_PATH: '/cms',
      ALINEA_HANDLER_URL: '/api/alinea'
    },
    images: {unoptimized: true}
  })

  test.equal(config.images, {
    unoptimized: true,
    localPatterns: [{pathname: '**', search: ''}, {pathname: '/cms/file/**'}]
  })
  const rewrites = await config.rewrites!()
  test.equal(rewrites, {
    beforeFiles: [],
    afterFiles: [
      {
        source: '/cms',
        destination: '/cms.html'
      }
    ],
    fallback: [
      {
        source: '/cms/file/:file*',
        destination: '/api/alinea?file=:file*&delivery=proxy'
      }
    ]
  })
})

test('preserves configured local image patterns', () => {
  const config = withAlinea({
    env: {ALINEA_ADMIN_PATH: '/admin'},
    images: {
      localPatterns: [{pathname: '/images/**'}]
    }
  })

  test.equal(config.images?.localPatterns, [
    {pathname: '/images/**'},
    {pathname: '/admin/file/**'}
  ])
})
