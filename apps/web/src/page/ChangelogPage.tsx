import {PageContainer, PageContent} from '@/layout/Page'
import {fromModule} from 'alinea/ui'
import fs from 'node:fs'
import path from 'node:path'
import {remark} from 'remark'
import html from 'remark-html'
import css from './ChangelogPage.module.scss'

const styles = fromModule(css)

export const metadata = {
  title: 'Changelog'
}

async function markdownToHtml(markdown: Buffer) {
  const result = await remark().use(html).process(markdown)
  return result.toString()
}

export default async function Changelog() {
  const filePath = path.join(process.cwd(), '../../changelog.md')
  const doc = fs.readFileSync(filePath)
  const content = await markdownToHtml(doc || '')
  return (
    <PageContainer>
      <PageContent>
        <div
          className={styles.root()}
          dangerouslySetInnerHTML={{__html: content}}
        />
      </PageContent>
    </PageContainer>
  )
}
