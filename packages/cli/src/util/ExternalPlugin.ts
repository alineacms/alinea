import * as path from '@alinea/core/util/Paths'
import type {Plugin} from 'esbuild'

export function externalPlugin(cwd: string): Plugin {
  return {
    name: 'external',
    setup(build) {
      build.onResolve({filter: /^[^\.].*/}, args => {
        if (args.kind === 'entry-point' || args.path.startsWith('@alinea'))
          return
        return build
          .resolve(args.path, {
            resolveDir: args.resolveDir
          })
          .then(res => {
            const isNodeModule = path
              .normalize(res.path)
              .split('/')
              .includes('node_modules')
            if (isNodeModule) return {path: args.path, external: true}
          })
      })
    }
  }
}
