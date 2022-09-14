import * as path from '@alinea/core/util/Paths'
import type {Plugin} from 'esbuild'

export function externalPlugin(cwd: string): Plugin {
  return {
    name: 'external',
    setup(build) {
      build.onResolve({filter: /^[^\.].*/}, args => {
        if (args.kind === 'entry-point') return
        return build
          .resolve(args.path, {
            resolveDir: args.resolveDir
          })
          .then(res => {
            const isRelative = path.contains(
              cwd.replace(/\\/g, '/'),
              res.path.replace(/\\/g, '/')
            )
            if (!isRelative) return {path: args.path, external: true}
          })
      })
    }
  }
}
