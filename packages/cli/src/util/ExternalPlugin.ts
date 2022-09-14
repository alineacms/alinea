import type {Plugin} from 'esbuild'

export const externalPlugin: Plugin = {
  name: 'external',
  setup(build) {
    build.onResolve({filter: /^[^\.].*/}, async args => {
      if (args.kind === 'entry-point') return
      const res = await build.resolve(args.path, {
        resolveDir: args.resolveDir
      })
      const isPackage =
        res.path.includes('node_modules') ||
        // Todo: his should only trigger during development
        res.path.replaceAll('\\', '/').includes('/alinea/packages')
      if (isPackage) return {path: args.path, external: true}
    })
  }
}
