import {expect, test} from 'bun:test'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {createServer} from 'node:net'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {$} from 'bun'

const API_KEY = 'alineapk_test_key'

// Build
const cwd = path.dirname(fileURLToPath(import.meta.url))
await $`bun run --cwd ${cwd} setup`

test('cloud sync updates test route', async () => {
  const port = await getAvailablePort()
  const server = spawn(
    'bun',
    ['run', '--silent', 'next', 'start', '-p', String(port)],
    {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ALINEA_API_KEY: API_KEY,
        ALINEA_BASE_URL: `http://localhost:${port}`
      },
      stdio: ['ignore', 'pipe', 'pipe']
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
  if (!server.pid || server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    once(server, 'close'),
    new Promise(resolve => setTimeout(resolve, 2_000))
  ])
  if (server.exitCode !== null) return
  server.kill('SIGKILL')
  await Promise.race([
    once(server, 'close'),
    new Promise(resolve => setTimeout(resolve, 2_000))
  ])
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

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string')
        return reject(new Error('Could not determine a free port'))
      server.close(error => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })
}
