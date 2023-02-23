import {initPages} from 'alinea/content/pages'
import fs from 'fs'
import path from 'path'
import {remark} from 'remark'
import html from 'remark-html'
import {ChangelogView} from '../view/ChangelogView'
import {layoutQuery} from '../view/layout/Layout.server'

export async function getStaticProps() {
  async function markdownToHtml(markdown: Buffer) {
    const result = await remark().use(html).process(markdown)
    return result.toString()
  }

  const pages = initPages()
  const filePath = path.join(process.cwd(), '../../changelog.md')
  const doc = fs.readFileSync(filePath)
  const content = await markdownToHtml(doc || '')

  return {
    props: {
      layout: await layoutQuery(pages, {
        type: '',
        title: 'Changelog',
        url: '/changelog'
      }),
      content
    }
  }
}

export default ChangelogView
