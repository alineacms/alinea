import {Blocks} from './blocks/Blocks'
import {InformationBar} from './layout/InformationBar'
import {Layout} from './layout/Layout'
import {PageSchema} from './Page.schema'

export function Page(props: PageSchema) {
  return (
    <Layout.WithSidebar sidebar={<InformationBar />}>
      <article>
        <Blocks blocks={props.blocks} />
      </article>
    </Layout.WithSidebar>
  )
}
