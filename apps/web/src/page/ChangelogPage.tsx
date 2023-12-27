import {InformationBar} from '@/layout/InformationBar'
import {LayoutContainer, LayoutScrollable} from '@/layout/Layout'
import {NavSidebar} from '@/layout/NavSidebar'
import {HStack, fromModule} from 'alinea/ui'
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
    <LayoutContainer>
      <HStack>
        <NavSidebar>
          <InformationBar />
        </NavSidebar>
        <LayoutScrollable>
          <div
            className={styles.root()}
            dangerouslySetInnerHTML={{__html: content}}
          />
        </LayoutScrollable>
      </HStack>
    </LayoutContainer>
  )
}
