import esbuild, {
  type BuildContext,
  type BuildOptions,
  type BuildResult
} from 'esbuild'
import {type Emitter, createEmitter} from '../util/Emitter.js'

export type BuildInfo =
  | {type: 'start'; result: undefined}
  | {type: 'done'; result: BuildResult}

export function buildEmitter(config: BuildOptions): Emitter<BuildInfo> {
  let context: BuildContext
  let canceled = false
  const results = createEmitter<BuildInfo>({
    onReturn() {
      context?.dispose()
      canceled = true
    }
  })
  esbuild
    .context({
      ...config,
      plugins: [
        ...(config.plugins || []),
        {
          name: 'build-iterator',
          setup(build) {
            build.onStart(() =>
              results.emit({type: 'start', result: undefined})
            )
            build.onEnd(result => results.emit({type: 'done', result}))
          }
        }
      ]
    })
    .then(ctx => {
      context = ctx
      if (!canceled) ctx.watch()
    }, results.throw)
  return results
}
