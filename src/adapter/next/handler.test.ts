import {Config} from '#/core/Config.js'
import {workspace} from '#/core/Workspace.js'
import {suite} from '@alinea/suite'
import {handlerPathname} from './handler.js'

const test = suite(import.meta)

test('uses the exact pathname of an absolute handler URL', () => {
  const config = {
    handlerUrl: 'https://example.com/api/custom',
    schema: {},
    workspaces: {
      main: workspace('Main', {source: 'content', roots: {}})
    }
  } satisfies Config

  const expected = handlerPathname(config, new URL('http://localhost/request'))

  test.is(expected, '/api/custom')
  test.not.is('/api/custom-extra', expected)
})
