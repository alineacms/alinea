import {createCMS} from '#/core.js'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import {Client} from './Client.js'
import {configFingerprintHeader} from './Connection.js'
import {HttpError} from './HttpError.js'
import {OutdatedDashboardError} from './OutdatedDashboardError.js'

const test = suite(import.meta)

const cms = createCMS({
  schema: {},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

/** A handler answering every request with `answer`, recording the config. */
async function withHandler(
  answer: () => Response,
  run: (url: string, sent: Array<string | null>) => Promise<void>
) {
  const sent = Array<string | null>()
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      sent.push(request.headers.get(configFingerprintHeader))
      return answer()
    }
  })
  try {
    await run(`http://localhost:${server.port}/api`, sent)
  } finally {
    await server.stop(true)
  }
}

test('tells listeners once the handler runs another config', async () => {
  let deployed = 'built'
  await withHandler(
    () =>
      Response.json('sha', {headers: {[configFingerprintHeader]: deployed}}),
    async (url, sent) => {
      const client = new Client({
        config: cms.config,
        url,
        configFingerprint: 'built'
      })
      let heard = 0
      client.onOutdated(() => heard++)
      await client.getSha()
      test.equal(sent, ['built'])
      test.is(heard, 0)

      deployed = 'deployed'
      await client.getSha()
      await client.getSha()
      test.is(heard, 1)
      // The authenticated client shares the state: a later listener hears it
      const authenticated = client.authenticate(
        init => init ?? {},
        () => {}
      )
      let late = 0
      authenticated.onOutdated(() => late++)
      test.is(late, 1)
    }
  )
})

test('a refused mutation of an outdated dashboard throws its own error', () =>
  withHandler(
    () =>
      Response.json(
        {success: false, error: 'outdated', outdated: true},
        {status: 409, headers: {[configFingerprintHeader]: 'deployed'}}
      ),
    async url => {
      const client = new Client({
        config: cms.config,
        url,
        configFingerprint: 'built'
      })
      let error: unknown
      try {
        await client.mutate([])
      } catch (caught) {
        error = caught
      }
      test.ok(error instanceof OutdatedDashboardError)
    }
  ))

test('other conflicts of an outdated dashboard keep their error', () =>
  withHandler(
    () =>
      Response.json(
        {success: false, error: 'Conflict'},
        {status: 409, headers: {[configFingerprintHeader]: 'deployed'}}
      ),
    async url => {
      const client = new Client({
        config: cms.config,
        url,
        configFingerprint: 'built'
      })
      let error: unknown
      try {
        await client.mutate([])
      } catch (caught) {
        error = caught
      }
      test.ok(error instanceof HttpError)
      test.not.ok(error instanceof OutdatedDashboardError)
    }
  ))

test('a page in front of the handler gets a short error', () =>
  withHandler(
    () =>
      new Response('<!DOCTYPE html><title>Error 401</title>', {
        status: 401,
        headers: {'content-type': 'text/html'}
      }),
    async url => {
      const client = new Client({config: cms.config, url})
      let error: unknown
      try {
        await client.mutate([])
      } catch (caught) {
        error = caught
      }
      test.is(
        (error as Error).message,
        `${url} answered 401 Unauthorized with a page instead of Alinea: ` +
          'is the site behind a password, eg. basic auth? Let requests to ' +
          `${url} through @ POST action mutate`
      )
    }
  ))
