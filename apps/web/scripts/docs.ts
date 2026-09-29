/**
 * Writes the docs as Markdown for the npm package, from the website content:
 * docs/index.md, a file per docs page in docs/ and llms-full.txt, all in the
 * repository root.
 *
 *   bun run docs
 *
 * Reads the content files directly, so it works offline and without a
 * running site. Expects the package to be built (`bun run build`).
 */
import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {Config} from 'alinea/core/Config'
import {FSSource} from 'alinea/core/source/FSSource'
import {LocalDB} from 'alinea/database/LocalDB'
import {cms, siteUrl} from '@/cms'
import {type DocLink, siteLink} from '@/page/docs/DocMarkdown'
import {docsFullText, docsIndex, exportDocs} from '@/page/docs/DocsExport'

const webDir = path.join(import.meta.dirname, '..')
const rootDir = path.join(webDir, '../..')
const docsDir = path.join(rootDir, 'docs')

// The content and the component examples are read relative to the website
process.chdir(webDir)

await using db = new LocalDB(cms.config)
await db.syncWith(new FSSource(Config.contentDir(cms.config)))
const docs = await exportDocs(db)

/** The file of a docs page, relative to the docs folder */
function docsFile(url: string) {
  return url === '/docs'
    ? 'introduction.md'
    : `${url.slice('/docs/'.length)}.md`
}

const urls = new Set(docs.pages.map(page => page.url))

// Links between docs pages are relative so they work in node_modules
function relativeLink(from: string): DocLink {
  const dir = path.posix.dirname(docsFile(from))
  return function link(href) {
    const [url, hash] = href.split('#')
    if (!urls.has(url)) return siteLink(href)
    const relative = path.posix.relative(dir, docsFile(url))
    return hash ? `${relative}#${hash}` : relative
  }
}

await rm(docsDir, {recursive: true, force: true})
for (const page of docs.pages) {
  const file = path.join(docsDir, docsFile(page.url))
  const body = docs.render(page, relativeLink(page.url))
  await mkdir(path.dirname(file), {recursive: true})
  await writeFile(file, `# ${page.title}\n\n${body}\n`)
}
const index = [
  '# Alinea docs',
  `The documentation of this version of Alinea, one Markdown file per page of ${siteUrl}/docs. All pages in a single file: ../llms-full.txt.`,
  docsIndex(docs.pages, docsFile)
]
await writeFile(path.join(docsDir, 'index.md'), `${index.join('\n\n')}\n`)
await writeFile(path.join(rootDir, 'llms-full.txt'), docsFullText(docs))
console.info(`Wrote ${docs.pages.length} docs pages to docs/ and llms-full.txt`)
