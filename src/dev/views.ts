import type {Plugin} from 'esbuild'
import fs from 'node:fs'

export const viewsPlugin: Plugin = {
  name: 'views',
  setup(build) {
    const clientImports = new Set<string>()
    build.onStart(() => {
      clientImports.clear()
    })
    build.onResolve({filter: /^#view\/.*/}, args => {
      clientImports.add(args.path)
      return {path: args.path, external: true}
    })

    build.onEnd(async () => {
      const imports: Record<string, any> = {}
      for (const file of clientImports) {
        const location = file.slice('#view/'.length)
        const server = location.replace('.view.', '.')
        imports[file] = {
          worker: `./${server}`,
          browser: `./${location}`,
          default: `./${server}`
        }
      }
      fs.writeFileSync(
        'dist/package.json',
        JSON.stringify({type: 'module', imports}, null, 2)
      )
    })
  }
}
