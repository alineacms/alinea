import {suite} from '@alinea/suite'
import {type ChildProcess, spawn} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const test = suite(import.meta)

const helper = new URL('./RunForwarded.ts', import.meta.url).pathname
const forwarder = `
  import {runForwarded} from ${JSON.stringify(helper)}
  runForwarded(process.env.FORWARD_COMMAND)
`

// Runs a shell with two sleeps in the background, writing all their pids
function startTree(parentOptions?: {wrap: boolean}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forwarded-'))
  const pidFile = path.join(dir, 'pids')
  const command = `sh -c 'echo $$ > ${pidFile}; sleep 1000 & echo $! >> ${pidFile}; sleep 1000 & echo $! >> ${pidFile}; wait'`
  const env = {...process.env, FORWARD_COMMAND: command, FORWARDER: forwarder}
  const child = parentOptions?.wrap
    ? // The trailing `; true` keeps sh from exec'ing into the forwarder
      spawn('sh', ['-c', `"${process.execPath}" -e "$FORWARDER"; true`], {
        env,
        stdio: 'ignore'
      })
    : spawn(process.execPath, ['-e', forwarder], {env, stdio: 'ignore'})
  const pids = waitFor(() => {
    const lines = fs.existsSync(pidFile)
      ? fs.readFileSync(pidFile, 'utf8').trim().split('\n')
      : []
    return lines.length === 3 ? lines.map(Number) : undefined
  })
  return {child, pids}
}

function exited(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  return new Promise(resolve => child.once('exit', code => resolve(code)))
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitFor<T>(check: () => T | undefined, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = check()
    if (result) return result
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Timed out')
}

test('SIGTERM stops the whole tree', async () => {
  const {child, pids} = startTree()
  const tree = await pids
  child.kill('SIGTERM')
  await exited(child)
  await waitFor(() => !tree.some(isAlive), 3000)
})

test('stops the tree when the parent is killed', async () => {
  const {child, pids} = startTree({wrap: true})
  const tree = await pids
  child.kill('SIGKILL')
  await waitFor(() => !tree.some(isAlive), 5000)
})

test('exits with the exit code of the command', async () => {
  const child = spawn(process.execPath, ['-e', forwarder], {
    env: {...process.env, FORWARD_COMMAND: 'exit 3'},
    stdio: 'ignore'
  })
  test.is(await exited(child), 3)
})
