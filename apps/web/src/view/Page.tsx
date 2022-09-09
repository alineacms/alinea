import {HStack} from '@alinea/ui'
import {Blocks} from './blocks/Blocks'
import {InformationBar} from './layout/InformationBar'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
import {PageShema} from './Page.schema'

export function Page(props: PageShema) {
  return (
    <Layout.Container>
      <HStack>
        <NavSidebar>
          <InformationBar />
        </NavSidebar>
        <Layout.Scrollable>
          <article>
            <Blocks blocks={props.blocks} />
          </article>
        </Layout.Scrollable>
      </HStack>
    </Layout.Container>
  )
}
