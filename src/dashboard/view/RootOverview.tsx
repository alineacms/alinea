import styler from '@alinea/styler'
import type {RootData} from '#/core/Root.js'
import {Icon, TextLabel, Typo} from '#/ui.js'
import {IcRoundDescription} from '#/ui/icons/IcRoundDescription.js'
import {Main} from '#/ui/Main.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import css from './RootOverview.module.scss'

const styles = styler(css)

export interface RootOverviewProps {
  root: RootData
}

export function RootOverview({root}: RootOverviewProps) {
  const workspace = useWorkspace()
  return (
    <>
      <Head>
        <title>{`${workspace.label}: ${root.label}`}</title>
      </Head>
      <Main>
        <div className={styles.root()}>
          <Icon
            icon={root.icon || IcRoundDescription}
            className={styles.root.icon()}
          />
          <Typo.H1>
            <TextLabel label={root.label} />
          </Typo.H1>
          <Typo.P style={{textAlign: 'center'}}>
            Select an entry in the navigation tree
            <br />
            on the left to start editing
          </Typo.P>
        </div>
      </Main>
    </>
  )
}
