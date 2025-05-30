import type {CMS} from 'alinea/core/CMS'
import {Config} from 'alinea/core/Config'
import {code} from 'alinea/core/util/CodeGen'
import {values} from 'alinea/core/util/Objects'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {Plugin} from 'esbuild'

export function viewsPlugin(rootDir: string, cms: CMS): Plugin {
  return {
    name: viewsPlugin.entry,
    setup(build) {
      const views = new Set(
        values(viewKeys).concat(
          Config.referencedViews(cms.config).filter(Boolean) as Array<string>
        )
      )
      const entry = `${[...views]
        .map((view, index) => {
          const separatorIndex = view.slice(1).lastIndexOf('#')
          const pkg =
            separatorIndex > -1 ? view.slice(0, separatorIndex + 1) : view
          const name =
            separatorIndex > -1 ? view.slice(separatorIndex + 2) : 'default'
          const alias = `view_${index}`
          return `import {${name} as ${alias}} from ${JSON.stringify(pkg)}`
        })
        .join('\n')}\n${code`
          import 'alinea/css'
          export const views = {
            ${[...views]
              .map((view, index) => {
                const alias = `view_${index}`
                return `  ${JSON.stringify(view)}: ${alias}`
              })
              .join(',\n')}
          }
        `}`
      build.onResolve({filter: new RegExp(`^${viewsPlugin.entry}$`)}, args => {
        return {path: args.path, namespace: viewsPlugin.entry}
      })
      build.onLoad({filter: /.*/, namespace: viewsPlugin.entry}, () => {
        return {
          contents: entry,
          resolveDir: rootDir
        }
      })
    }
  }
}

export namespace viewsPlugin {
  export const entry = '#alinea/views'
}
