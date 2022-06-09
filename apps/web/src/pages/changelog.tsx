import {backend} from '@alinea/content/backend.js'
import fs from 'fs'
import path from 'path'
import markdownToHtml from '../../lib/markdownToHtml'
import ChangelogView from '../view/ChangelogView'
import {Container} from '../view/layout/Container'
import {Layout} from '../view/layout/Layout'
import {LayoutProps, layoutQuery} from '../view/layout/Layout.server'

export type ChangelogProps = {
  layout: LayoutProps
  content: string
}

export default function Changelog({layout, content}: ChangelogProps) {
  return (
    <Layout {...layout}>
      <Layout.Content>
        <Container>
          <ChangelogView content={content} />
        </Container>
      </Layout.Content>
    </Layout>
  )
}

export async function getStaticProps() {
  const pages = backend.loadPages('web')
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
