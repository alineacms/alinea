import type {Plugin} from 'esbuild'

export const externalPlugin: Plugin = {
  name: 'external',
  setup(build) {
    build.onResolve({filter: /^[^\.].*/}, args => {
      if (args.kind === 'entry-point') return
      return {path: args.path, external: true}
    })
  }
}
