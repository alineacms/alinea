import {expect, test} from 'bun:test'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {$} from 'bun'

const CLOUD_MOCK_PATH = 'pages/en/root-page.json'
const CLOUD_MOCK_FILE = 'content/primary/pages/en/root-page.json'
const CLOUD_MOCK_TITLE_SUFFIX = ' (cloud)'
const API_KEY = 'alineapk_test_key'

// Build
const cwd = path.dirname(fileURLToPath(import.meta.url))
await $`bun run --cwd ${cwd} setup`

test('cloud sync updates test route', async () => {
  const port = 3000
  const server = spawn(
    'bun',
    ['run', '--silent', 'next', 'start', '-p', String(port)],
    {
      cwd,
      env: {...process.env, NODE_ENV: 'production', ALINEA_API_KEY: API_KEY},
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    }
  )
  try {
    server.stdout?.pipe(process.stdout)
    server.stderr?.pipe(process.stderr)
    await waitForServerStart(server, 5_000)
    const testResponse = await fetch(`http://localhost:${port}/test`)
    if (!testResponse.ok)
      throw new Error(`Unexpected status ${testResponse.status}`)
    const testBody = await testResponse.json()
    expect(testBody?.page?.title).toBe('Updated')
  } catch (error) {
    throw new Error('Cloud sync failed.', {cause: error})
  } finally {
    await stopServer(server)
  }
}, 30_000)

async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (!server.pid) return
  const pid = -server.pid
  process.kill(pid, 'SIGTERM')
  await once(server, 'close')
}

async function waitForServerStart(
  server: ReturnType<typeof spawn>,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (error?: Error) => {
      clearTimeout(timeout)
      server.stdout?.off('data', onData)
      server.stderr?.off('data', onData)
      server.off('exit', onExit)
      error ? reject(error) : resolve()
    }
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes('Ready in')) done()
    }
    const onExit = () => done(new Error('Next.js server exited before ready.'))
    const timeout = setTimeout(
      () => done(new Error('Timed out waiting for Next.js server start.')),
      timeoutMs
    )
    server.stdout?.on('data', onData)
    server.stderr?.on('data', onData)
    server.once('exit', onExit)
  })
}
