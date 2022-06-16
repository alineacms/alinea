import {getManifest} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'
import path from 'path'

const inline = new Set([])

function packageOf(filePath: string) {
  if (filePath.includes('node_modules'))
    filePath = filePath.split('node_modules')[1].slice(1)
  const segments = filePath.split(/\/|\\/)
  return filePath.startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0]
}

export const resolvePlugin: Plugin = {
  name: 'resolve',
  setup(build) {
    build.initialOptions.external = ['crypto', 'process']
    const info = new Map()
    const outExtension = build.initialOptions.outExtension?.['.js'] || '.js'
    function workspaceInfo(workspace: string) {
      if (!info.has(workspace)) {
        const manifest = getManifest(workspace)
        function getDeps(from: Record<string, string> | undefined) {
          return from ? Object.keys(from) : []
        }
        const dependencies = new Set(
          getDeps(manifest.dependencies)
            .concat(getDeps(manifest.peerDependencies))
            .concat(getDeps(manifest.optionalDependencies))
        )
        info.set(workspace, {
          name: manifest.name,
          dependencies,
          seen: new Set()
        })
      }
      return info.get(workspace)!
    }
    build.onResolve({filter: /.*/}, args => {
      if (args.kind === 'entry-point') return
      const isNodeModule = args.resolveDir.includes(`node_modules`)
      const fromPackage = isNodeModule
        ? packageOf(args.resolveDir)
        : packageOf(args.path)
      const isInline = inline.has(args.path) || inline.has(fromPackage)
      if (isInline) return
      const isLocal = args.path.startsWith('./') || args.path.startsWith('../')
      const hasOutExtension = args.path.endsWith(outExtension)
      const base = path.basename(args.path)
      const hasExtension = base.includes('.') && !base.includes('.node')
      if (!args.path.startsWith('.')) {
        const segments = args.path.split('/')
        const pkg = args.path.startsWith('@')
          ? `${segments[0]}/${segments[1]}`
          : segments[0]

        // From which package are we requesting this path?
        if (args.resolveDir.includes('packages')) {
          const paths = args.resolveDir.split(path.sep)
          const workspace = paths
            .slice(0, paths.lastIndexOf('src'))
            .join(path.sep)

          const {name, seen, dependencies} = workspaceInfo(workspace)
          if (
            !pkg.startsWith('node:') &&
            !dependencies.has(pkg) &&
            !seen.has(pkg)
          ) {
            if (pkg !== name)
              console.info(`warning: ${pkg} is not a dependency of ${name}`)
          }
          seen.add(pkg)
        }
      }
      if (isLocal && hasExtension && !hasOutExtension) return
      if (hasOutExtension || !isLocal) return {path: args.path, external: true}
      return {path: args.path + outExtension, external: true}
    })

    build.onEnd(() => {
      const knownWarnings = new Set([
        '@alinea/css', // As a convenience, maybe we should re-export in alinea?
        '@alinea/client', // In generated code
        '@alinea/sqlite-wasm', // In generated code
        'nodemailer' // Using types
      ])
      for (const {name, seen, dependencies} of info.values()) {
        const unused = [...dependencies].filter(x => !seen.has(x))
        for (const pkg of unused) {
          if (!knownWarnings.has(pkg))
            console.info(
              `info: ${pkg} is defined in dependencies, but appears unused in ${name}`
            )
        }
      }
    })
  }
}
