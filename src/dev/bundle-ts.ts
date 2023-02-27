import glob from 'glob'
import fs from 'node:fs'
import path from 'node:path'

export const bundleTs = {
  async action() {
    const root = './dist'
    const bundleRoot = './node_modules/.cache/bundle'
    const entries = glob.sync('**/*.d.ts', {cwd: root})
    let declaration = ''
    for (const entry of entries) {
      if (entry.includes('/static/')) continue
      const location = entry.slice(0, -'.d.ts'.length)
      const absolute = location === 'index' ? 'alinea' : `alinea/${location}`
      let contents = fs.readFileSync(path.join(root, entry), 'utf-8')
      // Strip shebang
      if (contents.startsWith('#!')) {
        contents = contents.slice(contents.indexOf('\n') + 1)
      }
      contents = contents.replace(
        /(from|import) '(\.\.?\/.*?)'/g,
        (match, p1, p2) => {
          const relative = path
            .join('alinea', path.dirname(location), p2)
            .replaceAll('\\', '/')
            .replace(/\.js$/, '')
          return `${p1} '${relative}'`
        }
      )
      contents = contents.replace(/import\("(\.\.?\/.*?)"\)/g, (match, p1) => {
        const relative = path
          .join('alinea', path.dirname(location), p1)
          .replaceAll('\\', '/')
          .replace(/\.js$/, '')
        return `import("${relative}")`
      })
      contents = contents.replace(/'#view\/(.*?)\.view\.js'/g, (match, p1) => {
        return `'alinea/${p1}'`
      })
      // Remove declare keyword
      contents = contents.replace(/declare /g, '')
      declaration += `declare module '${absolute}' {\n\n  ${contents.replace(
        /\n/g,
        '\n  '
      )}\n}\n\n`
    }
    fs.writeFileSync('./apps/web/src/data/alinea.d.ts.txt', declaration)
  }
}
