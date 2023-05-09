import type {Plugin} from 'esbuild'

export function externalPlugin(cwd: string): Plugin {
  return {
    name: 'external',
    setup(build) {
      build.onResolve({filter: /^[^\.].*/}, args => {
        if (args.kind === 'entry-point') return
        return {path: args.path, external: true}
        /*if (args.path === 'alinea' || args.path.startsWith('alinea/'))
          return {path: args.path, external: true}
        return build
          .resolve(args.path, {
            resolveDir: args.resolveDir,
            kind: args.kind
          })
          .then(res => {
            console.log(res)
            const isNodeModule = path
              .normalize(res.path)
              .split('/')
              .includes('node_modules')
            if (isNodeModule) return {path: args.path, external: true}
          })*/
      })
    }
  }
}
