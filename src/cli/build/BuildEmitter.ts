import esbuild, {
  type BuildContext,
  type BuildOptions,
  type BuildResult
} from 'esbuild'
import {type Emitter, createEmitter} from '../util/Emitter.js'

export type BuildInfo =
  | {type: 'start'; result: undefined}
  | {type: 'done'; result: BuildResult}

export interface BuildEmitterOptions {
  /** Rebuild on changes, otherwise build once and stop esbuild */
  watch?: boolean
}

export function buildEmitter(
  config: BuildOptions,
  {watch = true}: BuildEmitterOptions = {}
): Emitter<BuildInfo> {
  let context: BuildContext | undefined
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
    .then(async ctx => {
      context = ctx
      // Returned before the context was ready: nothing disposed it yet
      if (canceled) return ctx.dispose()
      if (watch) return ctx.watch()
      // A build runs once; a live context keeps the esbuild service process
      // around for as long as the forwarded command runs (and can outlive it)
      await ctx.rebuild().catch(() => {})
      context = undefined
      await ctx.dispose()
    }, results.throw)
  return results
}
