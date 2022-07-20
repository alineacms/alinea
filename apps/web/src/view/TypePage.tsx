import {HStack} from '@alinea/ui'
import {TypePageProps} from '../pages/types/[...path]'
import {Layout} from './layout/Layout'
import {NavSidebar} from './layout/NavSidebar'
import {NavTree} from './layout/NavTree'
import {WebTypo} from './layout/WebTypo'
import {Declaration} from './types/Declaration'
import {TypeRow} from './types/TypeRow'

export function TypePage({layout, title, members, nav}: TypePageProps) {
  if (!members.length) return null
  return (
    <Layout {...layout}>
      <Layout.Container>
        <HStack>
          <NavSidebar>
            <NavTree nav={nav} />
          </NavSidebar>

          <Layout.Scrollable>
            <div style={{flexGrow: 1, minWidth: 0}}>
              <WebTypo.H1 flat>{title}</WebTypo.H1>
              <Declaration members={members} wrap={TypeRow} />
            </div>
          </Layout.Scrollable>
        </HStack>
      </Layout.Container>
    </Layout>
  )
}
