import {Page} from 'alinea/content'
import {Blocks} from './blocks/Blocks.js'
import {InformationBar} from './layout/InformationBar.js'
import {Layout} from './layout/Layout.js'

export function Page(props: Page.Page) {
  return (
    <Layout.WithSidebar sidebar={<InformationBar />}>
      <article>
        <Blocks blocks={props.blocks} />
      </article>
    </Layout.WithSidebar>
  )
}
