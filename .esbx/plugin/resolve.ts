import {getManifest} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'
import path from 'path'

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
        const devDependencies = new Set(getDeps(manifest.devDependencies))
        info.set(workspace, {
          name: manifest.name,
          dependencies,
          devDependencies,
          seen: new Set()
        })
      }
      return info.get(workspace)!
    }
    const outDir = build.initialOptions.outdir
    const toVendor = new Map<string, Set<string>>()
    let sharedDependencies = new Set()
    build.onStart(() => {
      toVendor.clear()
      const shared = workspaceInfo('./packages/shared')
      sharedDependencies = shared.devDependencies
    })
    build.onResolve({filter: /.*/}, args => {
      if (args.kind === 'entry-point') return
      if (args.path.startsWith('lib0')) return
      const isNodeModule = args.resolveDir.includes(`node_modules`)
      if (
        sharedDependencies.has(args.path) &&
        !args.resolveDir.includes('shared')
      ) {
        return {path: `@alinea/shared/${args.path}`, external: true}
      }
      if (isNodeModule && !args.resolveDir.includes('@esbx')) return
      const pkg = isNodeModule
        ? packageOf(args.resolveDir)
        : packageOf(args.path)
      const isLocal = args.path.startsWith('./') || args.path.startsWith('../')
      const hasOutExtension = args.path.endsWith(outExtension)
      const base = path.basename(args.path)
      const hasExtension = base.includes('.') && !base.includes('.node')
      if (!args.path.startsWith('.')) {
        // From which package are we requesting this path?
        if (args.resolveDir.includes('packages')) {
          const paths = args.resolveDir.split(path.sep)
          const workspace = paths
            .slice(0, paths.lastIndexOf('src'))
            .join(path.sep)
          const {name, seen, dependencies, devDependencies} =
            workspaceInfo(workspace)
          if (devDependencies.has(pkg)) {
            const segmentsFromPkg = args.resolveDir
              .split(path.sep)
              .slice(paths.lastIndexOf('src') + 1)
            const isNode = workspace.endsWith('cli')
            const relativePath =
              (segmentsFromPkg.length === 0
                ? ['.']
                : segmentsFromPkg.map(() => '..')
              )
                .concat('vendor')
                .concat(pkg)
                .join('/') + (isNode ? '.cjs' : '.js')
            if (!toVendor.has(workspace)) toVendor.set(workspace, new Set())
            toVendor.get(workspace)!.add(pkg)
            return {path: relativePath, external: true}
          }
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

    const shared = {
      name: 'shared',
      setup(build) {
        build.onResolve({filter: /.*/}, args => {
          if (args.kind === 'entry-point') return
          if (sharedDependencies.has(args.path)) {
            return {path: `@alinea/shared/${args.path}`, external: true}
          }
        })
      }
    }

    build.onEnd(async () => {
      for (const [workspace, pkgs] of toVendor) {
        const {dependencies} = workspaceInfo(workspace)
        const isNode = workspace.endsWith('cli')
        await build.esbuild.build({
          format: isNode ? 'cjs' : 'esm',
          platform: isNode ? 'node' : undefined,
          bundle: true,
          entryPoints: Object.fromEntries(
            Array.from(pkgs).map(pkg => [pkg, pkg])
          ),
          outdir: workspace + '/dist/vendor',
          outExtension: {'.js': isNode ? '.cjs' : '.js'},
          conditions: ['import'],
          define: {
            'process.env.NODE_ENV': "'production'"
          },
          splitting: !isNode,
          treeShaking: true,
          external: [...dependencies],
          plugins: [shared]
        })
      }
      const knownWarnings = new Set([
        '@alinea/css', // As a convenience, maybe we should re-export in alinea?
        '@alinea/client', // In generated code
        '@alinea/sqlite-wasm', // In generated code
        'nodemailer', // Using types,
        // Make sure these are not inlined
        'react',
        'react-dom',
        'yjs',
        '@alinea/shared'
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
