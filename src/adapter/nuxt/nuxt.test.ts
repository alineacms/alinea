import {nextMocks} from '#test/NextMocks.js'
import {draftCookie} from '#/adapter/core/DraftCookie.js'
import {createCMS} from '#/adapter/server/node.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config} from '#/index.js'
import {beforeEach, expect, mock, test} from 'bun:test'
import {createServer, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import PLazy from 'p-lazy'
import {
  createNitroPlugin,
  type NitroApp,
  type NitroEvent,
  type NuxtRenderHtml
} from './NitroPlugin.js'
import alinea, {type NuxtInstance} from './NuxtModule.js'

const apiKey = 'nuxt-secret'

beforeEach(() => {
  nextMocks.handlerUrl = new URL('https://example.com/api/cms')
  nextMocks.apiKey = apiKey
})

function testCMS() {
  const resolve = mock(async (query: GraphQuery) => query)
  const db = {
    sha: 'content-hash',
    syncWith: async () => 'content-hash',
    resolve
  }
  const cms = createCMS(
    Config.create({
      baseUrl: 'https://example.com',
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {}
    })
  )
  cms.bundledDb = PLazy.from(async () => db as unknown as LocalStore)
  return {cms, resolve}
}

/** A Nitro app whose render runs `render`, served over http. */
async function serveApp(render: (event: NitroEvent) => Promise<void>) {
  const hooks: Array<(html: NuxtRenderHtml) => Promise<void>> = []
  const app: NitroApp = {
    h3App: {handler: render},
    hooks: {
      hook(_name, callback) {
        hooks.push(callback)
      }
    }
  }
  const server: Server = createServer((req, res) => {
    app.h3App.handler({node: {req, res}})
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
  const {port} = server.address() as AddressInfo
  return {
    app,
    hooks,
    url: `http://localhost:${port}`,
    close: () => server.close()
  }
}

async function draftHeaders() {
  const [pair] = (await draftCookie(apiKey, false)).split(';')
  return {cookie: pair}
}

test('the plugin answers alinea routes and renders the rest in the request', async () => {
  const {cms, resolve} = testCMS()
  const served = await serveApp(async ({node}) => {
    await cms.resolve({disableSync: true})
    node.res.end('page')
  })
  try {
    createNitroPlugin(cms)(served.app)

    const admin = await fetch(`${served.url}/admin`, {redirect: 'manual'})
    expect(admin.status).toBe(302)
    expect(admin.headers.get('location')).toBe('/admin.html')

    const page = await fetch(`${served.url}/page`, {
      headers: await draftHeaders()
    })
    expect(await page.text()).toBe('page')
    expect(resolve.mock.calls[0][0].status).toBe('preferDraft')
  } finally {
    served.close()
  }
})

test('draft renders get the previews client', async () => {
  const {cms} = testCMS()
  const bodies: Array<Array<string>> = []
  const served = await serveApp(async ({node}) => {
    const html = {bodyAppend: []}
    for (const hook of served.hooks) await hook(html)
    bodies.push(html.bodyAppend)
    node.res.end()
  })
  try {
    createNitroPlugin(cms)(served.app)
    await fetch(`${served.url}/page`)
    await fetch(`${served.url}/page`, {headers: await draftHeaders()})
    expect(bodies).toEqual([
      [],
      [
        '<script src="/admin/previews.js" data-dashboard-url="https://example.com/admin.html" defer></script>'
      ]
    ])
  } finally {
    served.close()
  }
})

test('a later plugin replaces the options of the first', async () => {
  const {cms} = testCMS()
  const bodies: Array<Array<string>> = []
  const served = await serveApp(async ({node}) => {
    const html = {bodyAppend: []}
    for (const hook of served.hooks) await hook(html)
    bodies.push(html.bodyAppend)
    node.res.end()
  })
  try {
    createNitroPlugin(cms)(served.app)
    createNitroPlugin({cms, previews: false})(served.app)
    expect(served.hooks).toHaveLength(1)
    await fetch(`${served.url}/page`, {headers: await draftHeaders()})
    expect(bodies).toEqual([[]])
  } finally {
    served.close()
  }
})

test('the module adds the plugins for the cms file', () => {
  const nuxt: NuxtInstance = {
    options: {
      rootDir: `${import.meta.dir}/../../../apps/web`,
      buildDir: '/project/.nuxt',
      alinea: {previews: {widget: true}},
      plugins: [],
      nitro: {}
    }
  }
  alinea({}, nuxt)
  const plugin = '/project/.nuxt/alinea.nitro.mjs'
  const {nitro, plugins} = nuxt.options
  expect(nitro.plugins).toEqual([plugin])
  expect(nitro.virtual?.[plugin]).toContain(
    'createNitroPlugin({cms, previews: {"widget":true}})'
  )
  expect(nitro.virtual?.[plugin]).toContain('/apps/web/src/cms.tsx"')
  expect(plugins).toEqual([
    {src: expect.stringMatching(/static\/refresh\.js$/), mode: 'client'}
  ])
})
