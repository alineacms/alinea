import {expect, test} from 'bun:test'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {Socket} from 'node:net'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {$} from 'bun'

// Build
const cwd = path.dirname(fileURLToPath(import.meta.url))
await $`bun run --cwd ${cwd} setup`

test('test route', async () => {
  const port = 3000
  const server = spawn(
    'bun',
    ['run', '--silent', 'next', 'start', '-p', String(port)],
    {
      cwd,
      env: {...process.env, NODE_ENV: 'production'},
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    }
  )
  try {
    server.stdout?.pipe(process.stdout)
    server.stderr?.pipe(process.stderr)
    await waitForServerStart(server, 5_000)
    const response = await fetch(`http://localhost:${port}/test`)
    if (!response.ok) throw new Error(`Unexpected status ${response.status}`)
    const body = await response.json()
    expect(body).toHaveProperty('page')
  } catch (error) {
    throw new Error('Next.js server failed to respond.', {cause: error})
  } finally {
    await stopServer(server)
  }
}, 30_000)

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
