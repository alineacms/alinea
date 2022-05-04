import {HStack, Typo} from '@alinea/ui'
import {TypePageProps} from '../pages/types/[...path]'
import {Container} from './layout/Container'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
import {NavTree} from './layout/NavTree'
import {Declaration} from './types/Declaration'
import {TypeRow} from './types/TypeRow'

export function TypePage({layout, title, members, nav}: TypePageProps) {
  if (!members.length) return null
  return (
    <Layout {...layout}>
      <Layout.Content>
        <Container>
          <HStack gap={80}>
            <NavSidebar>
              <NavTree nav={nav} />
            </NavSidebar>
            <div style={{flexGrow: 1, minWidth: 0}}>
              <Typo.H1>{title}</Typo.H1>
              <Declaration members={members} wrap={TypeRow} />
            </div>
          </HStack>
        </Container>
      </Layout.Content>
    </Layout>
  )
}
