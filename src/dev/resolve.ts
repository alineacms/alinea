import {getManifest, getWorkspaces} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'
import path from 'node:path'

function packageOf(filePath: string) {
  if (filePath.includes('node_modules'))
    filePath = filePath.split('node_modules')[1].slice(1)
  const segments = filePath.split(/\/|\\/)
  return filePath.startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0]
}

function getDeps(from: Record<string, string> | undefined) {
  return from ? Object.keys(from) : []
}

interface Dependency {
  format: 'esm' | 'cjs'
  bundle: boolean
  warnIfUnused?: boolean
}

function getDepsInfo() {
  const dependencies = new Map<string, Dependency>()
  for (const dir of getWorkspaces('.').concat('.')) {
    if (dir.includes('apps')) continue
    const isDev = dir.includes('dev') || dir.includes('test')
    const isRoot = dir === '.'
    const format = dir.includes('cli') ? 'cjs' : 'esm'
    const manifest = getManifest(dir)
    const deps = getDeps(manifest.dependencies)
      .concat(getDeps(manifest.peerDependencies))
      .concat(getDeps(manifest.optionalDependencies))
    for (const dep of deps)
      dependencies.set(dep, {format, bundle: false, warnIfUnused: true})
    const dev = getDeps(manifest.devDependencies)
    for (const dep of dev)
      if (!dep.startsWith('@types/'))
        dependencies.set(dep, {
          format,
          bundle: !isDev && !isRoot,
          warnIfUnused: !isRoot
        })
  }
  return dependencies
}

const external = [
  'next',
  '@remix-run/node',
  '@remix-run/react',
  'react/jsx-runtime'
]

export const resolvePlugin: Plugin = {
  name: 'resolve',
  setup(build) {
    const dependencies = getDepsInfo()
    const seen = new Set()
    build.initialOptions.external = external
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    const toVendor = {esm: new Set<string>(), cjs: new Set<string>()}
    build.onStart(() => {
      toVendor.esm.clear()
      toVendor.cjs.clear()
    })
    build.onResolve({filter: /.*/}, args => {
      if (args.kind === 'entry-point') return
      if (args.path.includes('lib0')) return
      const isNodeModule = args.resolveDir.includes(`node_modules`)
      const pkg = isNodeModule
        ? packageOf(args.resolveDir)
        : packageOf(args.path)
      const isLocal = args.path.startsWith('./') || args.path.startsWith('../')
      const isInternal =
        args.path.startsWith('alinea') ||
        args.path.startsWith('node:') ||
        external.includes(pkg)
      const hasOutExtension = args.path.endsWith(outExtension)
      const base = path.basename(args.path)
      const hasExtension = base.includes('.') && !base.includes('.node')
      if (!isInternal && !isLocal && pkg) {
        seen.add(pkg)
        const info = dependencies.get(pkg)
        if (!info) {
          console.error(
            `Unknown dependency ${pkg}, while bundling ${args.importer}`
          )
          process.exit(1)
        }
        if (!info.bundle) return {path: args.path, external: true}
        const isNode = info.format === 'cjs'
        const relativePath =
          ['alinea/vendor'].concat(pkg).join('/') + (isNode ? '.cjs' : '.js')
        toVendor[isNode ? 'cjs' : 'esm'].add(pkg)
        return {path: relativePath, external: true}
      }
      if (isLocal && hasExtension && !hasOutExtension) return
      if (hasOutExtension || !isLocal) return {path: args.path, external: true}
      return {path: args.path + outExtension, external: true}
    })

    build.onEnd(async () => {
      for (const [format, pkgs] of Object.entries(toVendor)) {
        const isNode = format === 'cjs'
        await build.esbuild.build({
          format: isNode ? 'cjs' : 'esm',
          platform: isNode ? 'node' : undefined,
          bundle: true,
          entryPoints: Object.fromEntries(
            Array.from(pkgs).map(pkg => [pkg, pkg])
          ),
          outdir: './dist/vendor',
          outExtension: {'.js': isNode ? '.cjs' : '.js'},
          conditions: ['import'],
          define: {
            'process.env.NODE_ENV': "'production'"
          },
          splitting: !isNode,
          treeShaking: true,
          external
        })
      }
      const knownWarnings = new Set([
        'y-webrtc',
        'better-sqlite3',
        'firebase-admin',
        'ioredis',
        'nodemailer'
      ])
      const unused = [...dependencies].filter(([name, {warnIfUnused}]) => {
        return warnIfUnused && !seen.has(name) && !knownWarnings.has(name)
      })
      for (const pkg of unused)
        console.info(
          `info: defined in dependencies, but appears unused: "${pkg}"`
        )
    })
  }
}
