import type {Plugin} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'

export const viewsPlugin: Plugin = {
  name: 'views',
  setup(build) {
    const clientImports = new Map<string, string>()
    const root = path.join(process.cwd(), 'src')
    build.onStart(() => {
      clientImports.clear()
    })
    build.onResolve({filter: /^#view\/.*/}, args => {
      const source = path.relative(root, args.importer)
      clientImports.set(source, args.path)
      return {path: args.path, external: true}
    })
    build.onEnd(async () => {
      const imports: Record<string, any> = {}
      for (const [source, file] of clientImports) {
        const location = file.slice('#view/'.length)
        const server = location.replace('.view.', '.')
        imports[file] = {
          worker: `./${server}`,
          browser: `./${location}`,
          default: `./${server}`
        }
        const relative = path
          .relative(path.dirname(source), location)
          .replaceAll('\\', '/')
        fs.writeFileSync(
          `dist/${source.slice(0, -3)}.d.ts`,
          `export * from './${relative}';\n`
        )
      }
      fs.writeFileSync(
        'dist/package.json',
        JSON.stringify({type: 'module', name: 'alinea', imports}, null, 2)
      )
    })
  }
}
