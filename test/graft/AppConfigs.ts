import {existsSync} from 'node:fs'
import {join} from 'node:path'
import type {CMS} from '#/core/CMS.js'
import {plugin} from 'bun'

const src = join(import.meta.dir, '../../src')

// The apps import alinea by its package name, which points to the build.
// Runtime plugins only load, so their imports are rewritten to the source.
plugin({
  name: 'alinea-src',
  setup(build) {
    build.onLoad({filter: /[\\/]apps[\\/].*\.tsx?$/}, async args => {
      const source = await Bun.file(args.path).text()
      const contents = source.replace(
        /(from\s+|import\s*\(\s*)(['"])alinea(\/[^'"]*)?\2/g,
        (_, start, quote, sub = '') =>
          `${start}${quote}${resolveSrc(sub)}${quote}`
      )
      return {contents, loader: args.path.endsWith('x') ? 'tsx' : 'ts'}
    })
  }
})

function resolveSrc(sub: string): string {
  const base = join(src, sub.replace(/^\//, '') || 'index')
  for (const ext of ['.ts', '.tsx', '/index.ts'])
    if (existsSync(base + ext)) return base + ext
  throw new Error(`Cannot find alinea${sub}`)
}

export interface Corpus {
  name: string
  cms: CMS
  dir: string
}

/** The configs of the content in this repository, with where it lives */
export async function corpora(): Promise<Array<Corpus>> {
  const root = join(import.meta.dir, '../..')
  // The apps are left out of the type check, so they are loaded by path
  const app = async (name: string): Promise<{cms: CMS}> =>
    import(join(root, `apps/${name}/src/cms.tsx`))
  const dev = await app('dev')
  const web = await app('web')
  const fixture = await import('#/dashboard/fixture/cms.js')
  return [
    {name: 'dev', cms: dev.cms, dir: join(root, 'apps/dev')},
    {name: 'web', cms: web.cms, dir: join(root, 'apps/web')},
    {
      name: 'fixture',
      cms: fixture.cms,
      dir: join(root, 'src/dashboard/fixture')
    }
  ]
}
