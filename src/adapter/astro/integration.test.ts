import {afterEach, expect, mock, test} from 'bun:test'
import {alinea, previewsScript} from './integration.js'

const env = {...process.env}

afterEach(() => {
  for (const name of ['ALINEA_DEV_SERVER', 'ALINEA_ADMIN_PATH']) {
    if (env[name] === undefined) delete process.env[name]
    else process.env[name] = env[name]
  }
})

test('pages get the client router refresh', () => {
  const injectScript = mock((_stage: 'page', _content: string) => {})
  alinea().hooks['astro:config:setup']({injectScript})
  expect(injectScript).toHaveBeenCalledWith('page', previewsScript)
  expect(previewsScript).toContain("import('astro:transitions/client')")
})

test('the dashboard location is printed in development', () => {
  process.env.ALINEA_DEV_SERVER = 'http://localhost:4500'
  process.env.ALINEA_ADMIN_PATH = '/admin'
  const logger = {info: mock((_message: string) => {}), warn: mock(() => {})}
  alinea().hooks['astro:server:start']({address: {port: 4321}, logger})
  expect(logger.info).toHaveBeenCalledWith(
    'Dashboard: http://localhost:4321/admin'
  )
  delete process.env.ALINEA_DEV_SERVER
  alinea().hooks['astro:server:start']({address: {port: 4321}, logger})
  expect(logger.warn).toHaveBeenCalledTimes(1)
})
