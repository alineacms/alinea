import {suite} from '@alinea/suite'
import {hasLocalMatch} from 'next/dist/shared/lib/match-local-pattern.js'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
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

test('routes files through the handler and keeps the default local images', async () => {
  const config = withAlinea({
    env: {
      ALINEA_ADMIN_PATH: '/cms',
      ALINEA_HANDLER_URL: '/api/alinea'
    },
    images: {unoptimized: true}
  })

  test.equal(config.images, {
    unoptimized: true,
    localPatterns: [{pathname: '/cms/file/**'}, {pathname: '**', search: ''}]
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
  test.ok(
    hasLocalMatch(config.images?.localPatterns, '/admin/file/hero.jpg?v=1a2b')
  )
})

test('lets the image optimizer load versioned file urls', () => {
  const {localPatterns} = withAlinea({
    env: {ALINEA_ADMIN_PATH: '/admin'}
  }).images!
  const allowed = (url: string) => hasLocalMatch(localPatterns, url)

  test.ok(allowed('/admin/file/screenshots/product.webp?v=f7643a7b'))
  test.ok(allowed('/admin/file/screenshots/product.webp'))
  // Next only allows local images without a query by default
  test.ok(allowed('/images/hero.jpg'))
  test.not.ok(allowed('/images/hero.jpg?v=1'))
})

test('uses the routing settings of the build when next start loads the config', () => {
  const previousNodeEnv = process.env.NODE_ENV
  const distDir = mkdtempSync(join(tmpdir(), 'alinea-next-'))
  process.env.NODE_ENV = 'production'
  try {
    writeFileSync(
      join(distDir, 'required-server-files.json'),
      JSON.stringify({
        config: {
          env: {ALINEA_ADMIN_PATH: '/cms', ALINEA_HANDLER_URL: '/api/alinea'}
        }
      })
    )
    const config = withAlinea({distDir})

    test.equal(config.env, {
      ALINEA_ADMIN_PATH: '/cms',
      ALINEA_HANDLER_URL: '/api/alinea'
    })
    test.equal(config.images?.localPatterns?.[0], {pathname: '/cms/file/**'})
  } finally {
    rmSync(distDir, {recursive: true, force: true})
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})

test('routes development files through the CLI dev handler', async () => {
  const previousDevServer = process.env.ALINEA_DEV_SERVER
  const previousNodeEnv = process.env.NODE_ENV
  process.env.ALINEA_DEV_SERVER = 'http://localhost:4500'
  process.env.NODE_ENV = 'development'
  try {
    const redirects = async () => []
    const config = withAlinea({
      env: {
        ALINEA_ADMIN_PATH: '/admin',
        ALINEA_HANDLER_URL: '/api/cms'
      },
      redirects
    })

    // The dev server only listens on 127.0.0.1, so the browser must never be
    // sent there: everything, including the ~dev event stream, is proxied
    test.is(config.redirects, redirects)
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
