import {afterAll, beforeAll, expect, setDefaultTimeout, test} from 'bun:test'
import {execFile} from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import {promisify} from 'node:util'
import {Client} from '#/core/Client.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {createFileHash} from '#/core/util/ContentHash.js'
import {cms} from './fixtures/self-hosted/cms.js'
import {
  startSelfHostedServer,
  type SelfHostedServer
} from './support/SelfHostedServer.js'

const rootDir = path.resolve('e2e/tmp/self-hosted')
let server: SelfHostedServer
const execFileAsync = promisify(execFile)

setDefaultTimeout(120_000)

const dashboardScript = String.raw`
import {chromium} from 'playwright'

const url = process.env.ALINEA_E2E_URL
if (!url) throw new Error('Missing ALINEA_E2E_URL')
const title = process.env.ALINEA_E2E_TITLE
if (!title) throw new Error('Missing ALINEA_E2E_TITLE')

const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    httpCredentials: {
      username: 'admin',
      password: 'password'
    }
  })
  const page = await context.newPage()
  const githubRequests = []
  page.setDefaultTimeout(45_000)
  await page.route('https://api.github.com/**', route => {
    githubRequests.push(route.request().url())
    return route.abort()
  })

  await page.goto(url)
  await page.getByText('Self hosted', {exact: true}).waitFor({
    state: 'visible'
  })
  await page.getByRole('button', {name: 'Pages'}).click()
  await page.getByText('Pages').waitFor({state: 'visible'})
  await page.getByRole('button', {name: 'Create entry'}).click()
  const dialog = page.getByRole('dialog', {name: 'Create entry'})
  await dialog.getByLabel('Title').fill(title)
  await dialog.getByRole('button', {name: 'Create entry'}).click()
  await dialog.waitFor({state: 'hidden'})
  await context.close()

  console.log(JSON.stringify({githubRequests}))
} finally {
  await browser.close()
}
`

beforeAll(async () => {
  await fs.rm(rootDir, {recursive: true, force: true})
  await fs.cp(path.resolve('e2e/fixtures/self-hosted'), rootDir, {
    recursive: true
  })
  await fs.writeFile(
    path.join(rootDir, 'tsconfig.json'),
    JSON.stringify(createFixtureTsConfig(), null, 2)
  )
  server = await startSelfHostedServer({
    rootDir,
    configFile: 'cms.ts'
  })
})

afterAll(async () => {
  await server?.close()
})

test('rejects missing and wrong login credentials', async () => {
  await expectUnauthorized(await authStatus())
  await expectUnauthorized(await authStatus('admin:wrong-password'))
})

test('logs into the dashboard and creates an entry through createBackend', async () => {
  await createEntryInDashboard('E2E created page')

  const client = createClient()
  await uploadImage(client)

  const user = await client.user()
  const pages = await client.resolve({
    type: cms.config.schema.Page,
    select: {
      title: cms.config.schema.Page.title
    }
  })
  const media = await client.resolve({
    type: MediaFile,
    select: {
      title: MediaFile.title,
      location: MediaFile.location
    }
  })

  expect(user?.sub).toBe('e2e-admin')
  expect(pages.map(page => page.title)).toContain('Self hosted home')
  expect(pages.map(page => page.title)).toContain('E2E created page')
  expect(media).toContainEqual({
    title: 'e2e-upload',
    location: expect.stringContaining('e2e-upload')
  })
})

async function authStatus(credentials?: string): Promise<Response> {
  const headers = new Headers({accept: 'application/json'})
  if (credentials) headers.set('Authorization', `Basic ${btoa(credentials)}`)
  return fetch(`${server.url}/api?action=auth&auth=status`, {headers})
}

async function expectUnauthorized(response: Response) {
  expect(response.status).toBe(401)
  expect(response.headers.get('www-authenticate')).toBe(
    'Basic realm="Secure Area"'
  )
  expect(await response.text()).toBe('Unauthorized')
}

async function createEntryInDashboard(title: string) {
  const {stdout} = await execFileAsync(
    'node',
    ['--input-type=module', '--eval', dashboardScript],
    {
      env: {
        ...process.env,
        ALINEA_E2E_URL: server.url,
        ALINEA_E2E_TITLE: title
      },
      timeout: 60_000
    }
  )
  expect(JSON.parse(stdout)).toEqual({githubRequests: []})
}

function createClient(): Client {
  return new Client({
    config: cms.config,
    url: `${server.url}/api`,
    applyAuth(init) {
      return {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: basicAuth()
        }
      }
    }
  })
}

function basicAuth() {
  return `Basic ${btoa('admin:password')}`
}

async function uploadImage(client: Client) {
  const file = tinyPng()
  const upload = await client.prepareUpload('media/e2e-upload.png')
  const response = await fetch(upload.url, {
    method: upload.method ?? 'POST',
    headers: {
      authorization: basicAuth(),
      'content-type': 'image/png'
    },
    body: file
  })
  expect({
    status: response.status,
    body: await response.text(),
    url: upload.url
  }).toEqual({
    status: 200,
    body: 'OK',
    url: upload.url
  })

  const extension = '.png'
  const location = upload.location.startsWith('media')
    ? upload.location.slice('media'.length)
    : upload.location
  await client.mutate([
    {
      op: 'uploadFile',
      url: upload.previewUrl,
      location: upload.location
    },
    {
      op: 'create',
      id: upload.entryId,
      locale: null,
      parentId: null,
      type: 'MediaFile',
      root: 'media',
      workspace: 'main',
      data: {
        title: 'e2e-upload',
        location,
        previewUrl: upload.previewUrl,
        extension,
        size: file.byteLength,
        hash: await createFileHash(file)
      },
      overwrite: false
    }
  ])
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  )
}

function createFixtureTsConfig() {
  const sourceDir = path.resolve('src').replaceAll('\\', '/')
  return {
    compilerOptions: {
      module: 'ESNext',
      target: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      skipLibCheck: true,
      paths: {
        '#/*': [`${sourceDir}/*`],
        alinea: [`${sourceDir}/index.ts`],
        'alinea/*': [`${sourceDir}/*`]
      }
    }
  }
}
