import esbuild, {BuildContext, BuildOptions, BuildResult} from 'esbuild'
import {createEmitter, Emitter} from '../util/Emitter.js'

export type BuildInfo =
  | {type: 'start'; result: undefined}
  | {type: 'done'; result: BuildResult}

export function buildEmitter(config: BuildOptions): Emitter<BuildInfo> {
  let context: BuildContext,
    canceled = false
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
