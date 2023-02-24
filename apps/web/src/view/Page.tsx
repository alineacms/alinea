import {Page} from '@alinea/content'
import {Blocks} from './blocks/Blocks'
import {InformationBar} from './layout/InformationBar'
import {Layout} from './layout/Layout'

export function Page(props: Page.Page) {
  return (
    <Layout.WithSidebar sidebar={<InformationBar />}>
      <article>
        <Blocks blocks={props.blocks} />
      </article>
    </Layout.WithSidebar>
  )
}
