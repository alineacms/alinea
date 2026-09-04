import {expect, test} from 'bun:test'
import {generatedEnvironment} from './GeneratedEnvironment.js'

test('describes how to configure a missing generated environment', () => {
  expect(() => generatedEnvironment({})).toThrow(
    'Wrap your Next.js configuration with withAlinea from "alinea/next"'
  )
  expect(() => generatedEnvironment({})).toThrow('ALINEA_GENERATED_RELEASE')
})

test('returns a complete generated environment', () => {
  expect(
    generatedEnvironment({
      ALINEA_ADMIN_PATH: '/admin',
      ALINEA_GENERATED_RELEASE: 'release',
      ALINEA_GENERATED_CONFIG: 'config',
      ALINEA_RELEASE_URL: '/admin/release/payload.bundle',
      ALINEA_CONFIG_URL: '/admin/config/config/client-config.js'
    })
  ).toEqual({
    adminPath: '/admin',
    releaseId: 'release',
    configId: 'config',
    releaseUrl: '/admin/release/payload.bundle',
    configUrl: '/admin/config/config/client-config.js'
  })
})
