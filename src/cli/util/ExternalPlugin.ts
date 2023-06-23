import {dirname, normalize, relative} from 'alinea/core/util/Paths'
import type {Plugin} from 'esbuild'
import {createPathsMatcher, getTsconfig} from 'get-tsconfig'

export function externalPlugin(cwd: string): Plugin {
  return {
    name: 'external',
    setup(build) {
      const tsConfig = getTsconfig(cwd)
      const rootDir = tsConfig && normalize(dirname(tsConfig.path))
      const pathsMatcher = tsConfig && createPathsMatcher(tsConfig)
      build.onResolve({filter: /^[^\.].*/}, async ({path, ...args}) => {
        if (args.kind === 'entry-point') return
        const extern = {path, external: true}
        if (!tsConfig || !rootDir || !pathsMatcher) return extern
        const tryPaths = pathsMatcher(path)
        if (tryPaths.length === 0) return extern
        for (const attempt of tryPaths) {
          const location = relative(rootDir, attempt)
          const resolved = await build.resolve(`./${location}`, {
            kind: args.kind,
            resolveDir: rootDir
          })
          if (resolved) return resolved
        }
        return extern
      })
    }
  }
}
