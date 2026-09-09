import {createConfig} from '#/core/Config.js'
import type {RequestContext} from '#/core/Connection.js'
import {suite} from '@alinea/suite'
import {CloudRemote} from './CloudRemote.js'

const test = suite(import.meta)

test('does not expose unsupported user management', async () => {
  const context: RequestContext = {
    apiKey: 'project_test',
    handlerUrl: new URL('https://cms.example.com/api'),
    isDev: false
  }
  const config = createConfig({schema: {}, workspaces: {}})
  const remote = new CloudRemote(context, config)

  test.equal(await remote.capabilities(), {users: false})
})
