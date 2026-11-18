import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** A bare repository served over smart HTTP by `git http-backend` */
export interface GitHost extends Disposable {
  url: string
  dir: string
  git(...args: Array<string>): string
}

export function gitHost(): GitHost {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-host-'))
  const dir = path.join(root, 'site.git')
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', dir])
  // As hosts such as GitHub do: graft fetches trees without their blobs
  for (const [key, value] of [
    ['http.receivepack', 'true'],
    ['uploadpack.allowFilter', 'true'],
    ['uploadpack.allowAnySHA1InWant', 'true']
  ])
    execFileSync('git', ['--git-dir', dir, 'config', key, value])
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const url = new URL(request.url)
      const body = new Uint8Array(await request.arrayBuffer())
      const env: Record<string, string> = {
        ...(process.env as Record<string, string>),
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: '1',
        PATH_INFO: url.pathname,
        QUERY_STRING: url.search.slice(1),
        REQUEST_METHOD: request.method,
        CONTENT_TYPE: request.headers.get('content-type') ?? '',
        CONTENT_LENGTH: String(body.length),
        REMOTE_USER: 'alinea',
        REMOTE_ADDR: '127.0.0.1'
      }
      const protocol = request.headers.get('git-protocol')
      if (protocol) env.HTTP_GIT_PROTOCOL = env.GIT_PROTOCOL = protocol
      const child = Bun.spawn(['git', 'http-backend'], {
        env,
        stdin: body,
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const [output] = await Promise.all([
        new Response(child.stdout).arrayBuffer(),
        child.exited
      ])
      return cgiResponse(new Uint8Array(output))
    }
  })
  return {
    url: `http://127.0.0.1:${server.port}/site.git`,
    dir,
    git: (...args) =>
      execFileSync('git', ['--git-dir', dir, ...args], {encoding: 'utf-8'}),
    [Symbol.dispose]() {
      server.stop(true)
    }
  }
}

function cgiResponse(output: Uint8Array): Response {
  const text = new TextDecoder('latin1').decode(output)
  let end = text.indexOf('\r\n\r\n')
  let gap = 4
  if (end < 0) {
    end = text.indexOf('\n\n')
    gap = 2
  }
  if (end < 0) return new Response('Invalid CGI output', {status: 502})
  const headers = new Headers()
  let status = 200
  for (const line of text.slice(0, end).split(/\r?\n/)) {
    const colon = line.indexOf(':')
    const name = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (name.toLowerCase() === 'status') status = Number.parseInt(value, 10)
    else headers.append(name, value)
  }
  return new Response(output.slice(end + gap), {status, headers})
}

/**
 * Runs git without blocking, as the hosts it talks to answer in this
 * process
 */
export async function git(cwd: string, ...args: Array<string>) {
  const child = Bun.spawn(['git', ...args], {
    cwd,
    env: {...process.env, GIT_TERMINAL_PROMPT: '0'},
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])
  if (code !== 0) throw new Error(`git ${args.join(' ')}: ${stderr}`)
  return stdout
}

/** A working copy of a host, for a developer's pushes */
export async function workingCopy(host: GitHost) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-dev-'))
  await git(dir, 'clone', '-q', host.url, '.')
  await git(dir, 'config', 'user.name', 'Developer')
  await git(dir, 'config', 'user.email', 'dev@example.com')
  await git(dir, 'config', 'commit.gpgsign', 'false')
  return {dir, git: (...args: Array<string>) => git(dir, ...args)}
}
