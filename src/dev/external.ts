import {getManifest, getWorkspaces} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'

function getDeps(from: Record<string, string> | undefined) {
  return from ? Object.keys(from) : []
}

function externalDeps() {
  const res = new Set<string>()
  for (const dir of getWorkspaces('.').concat('.')) {
    if (dir.includes('apps')) continue
    const isDev = dir.includes('dev') || dir.includes('test')
    const isRoot = dir === '.'
    const manifest = getManifest(dir)
    const deps = getDeps(manifest.dependencies)
      .concat(getDeps(manifest.peerDependencies))
      .concat(getDeps(manifest.optionalDependencies))
    for (const dep of deps) res.add(dep)
    const dev = getDeps(manifest.devDependencies)
    for (const dep of dev)
      if (!dep.startsWith('@types/') && (isDev || isRoot)) res.add(dep)
  }
  return Array.from(res)
}

const external = [
  'next',
  '@remix-run/node',
  '@remix-run/react',
  'react/jsx-runtime',
  'react',
  'react-dom',

  // Node packages
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib'
]

export const externalPlugin: Plugin = {
  name: 'external',
  setup(build) {
    const dependencies = external.concat(externalDeps())
    build.initialOptions.external = dependencies

    build.onResolve({filter: /^node:.*/}, args => {
      return {path: args.path, external: true}
    })
  }
}
