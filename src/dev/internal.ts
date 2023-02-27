import type {Plugin} from 'esbuild'
import path from 'node:path'

export const internalPlugin: Plugin = {
  name: 'internal',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    const clientImports = new Set<string>()
    build.onStart(() => {
      clientImports.clear()
    })
    build.onResolve({filter: /^alinea\/.*/}, args => {
      if (args.path === 'alinea/css') return {path: args.path, external: true}
      const requested = args.path.slice('alinea/'.length)
      const relative = path
        .relative(args.resolveDir, path.join(src, requested + '.js'))
        .replaceAll('\\', '/')
      return {path: './' + relative, external: true}
    })
  }
}

/*
if (args.path === 'alinea/css') return {path: args.path, external: true}
const requested = args.path.slice('alinea/'.length)
return build
  .resolve(`./src/${requested}`, {
    importer: args.importer,
    kind: args.kind,
    resolveDir: process.cwd()
  })
  .then(result => {
    return {...result, external: true}
  })*/
