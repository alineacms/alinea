import {suite} from '@alinea/suite'
import {generatedDatabaseFile} from '#/core/Version.js'
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
  test.equal(config.outputFileTracingIncludes, {
    '/*': [`./node_modules/@alinea/generated/${generatedDatabaseFile}`]
  })
})

test('routes files through the handler without restricting local images', async () => {
  const config = withAlinea({
    env: {
      ALINEA_ADMIN_PATH: '/cms',
      ALINEA_HANDLER_URL: '/api/alinea'
    },
    images: {unoptimized: true}
  })

  test.equal(config.images, {
    unoptimized: true
  })
  const rewrites = await config.rewrites!()
  test.equal(rewrites, {
    beforeFiles: [
      {
        source: '/cms/file/:file*',
        destination: '/api/alinea?file=:file*&delivery=proxy'
      }
    ],
    afterFiles: [
      {
        source: '/cms',
        destination: '/cms.html'
      }
    ],
    fallback: []
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

test('routes development files through the CLI dev handler', async () => {
  const previousDevServer = process.env.ALINEA_DEV_SERVER
  const previousNodeEnv = process.env.NODE_ENV
  process.env.ALINEA_DEV_SERVER = 'http://localhost:4500'
  process.env.NODE_ENV = 'development'
  try {
    const config = withAlinea({
      env: {
        ALINEA_ADMIN_PATH: '/admin',
        ALINEA_HANDLER_URL: '/api/cms'
      }
    })

    const rewrites = await config.rewrites!()
    test.equal(rewrites, {
      beforeFiles: [
        {
          source: '/admin/file/:file*',
          destination: 'http://localhost:4500/api?file=:file*&delivery=proxy'
        },
        {
          source: '/admin/:path*',
          destination: 'http://localhost:4500/admin/:path*'
        }
      ],
      afterFiles: [],
      fallback: []
    })
  } finally {
    if (previousDevServer === undefined) delete process.env.ALINEA_DEV_SERVER
    else process.env.ALINEA_DEV_SERVER = previousDevServer
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})
