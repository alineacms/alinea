import {Blocks} from './blocks/Blocks'
import {Layout} from './layout/Layout'
import {PageShema} from './Page.schema'

export function Page(props: PageShema) {
  return (
    <article>
      <Layout.Content>
        <Blocks blocks={props.blocks} container={Layout.Container} />
      </Layout.Content>
    </article>
  )
}
