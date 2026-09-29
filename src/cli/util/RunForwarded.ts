import {spawn} from 'node:child_process'
import {constants} from 'node:os'
import {onExit} from 'signal-exit'
import treeKill from 'tree-kill'

const forwarded = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const
// Set when we are started by runForwarded. Processes in between (shells, volta
// shims) stay alive when our forwarder is killed so a changed parent pid does
// not tell us. Not passed on to our own descendants.
const forwarder = Number(process.env.ALINEA_FORWARDER_PID)
delete process.env.ALINEA_FORWARDER_PID

/**
 * Runs a command given after `--` (`alinea dev -- next dev`) and takes its
 * whole process tree down with us. Signals sent to us alone (`kill`, `pkill`,
 * SIGHUP) would otherwise only reach the shell or version manager shims such
 * as volta, which do not pass them on. The command stays in our process group
 * so Ctrl+C and interactive terminal use work as before.
 */
export function runForwarded(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  exit: (code: number) => void = code => process.exit(code)
) {
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env: {...env, ALINEA_FORWARDER_PID: String(process.pid)}
  })
  const kill = (signal: NodeJS.Signals = 'SIGTERM') => {
    if (child.pid) treeKill(child.pid, signal)
  }
  // Exits we can't wait on (uncaught errors, process.exit) only get to
  // signal the child synchronously
  const removeExitHandler = onExit(() => void child.kill())
  const stopWatching = watchParent(() => kill())
  for (const signal of forwarded) process.on(signal, kill)
  child.on('exit', (code, signal) => {
    removeExitHandler()
    stopWatching()
    for (const signal of forwarded) process.off(signal, kill)
    exit(code ?? 128 + (signal ? constants.signals[signal] : 0))
  })
  return child
}

/**
 * Calls `onOrphan` once our parent process or forwarder is gone (killed with
 * SIGKILL for example). A process started from a shell keeps it as parent.
 */
export function watchParent(onOrphan: () => void) {
  const parent = process.ppid
  const timer = setInterval(() => {
    if (process.ppid === parent && (!forwarder || isAlive(forwarder))) return
    clearInterval(timer)
    onOrphan()
  }, 1000)
  timer.unref()
  return () => clearInterval(timer)
}

function isAlive(pid: number) {
  try {
    return process.kill(pid, 0)
  } catch {
    return false
  }
}
