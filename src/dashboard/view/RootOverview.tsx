import styler from '@alinea/styler'
import type {RootData} from 'alinea/core/Root'
import {Icon, TextLabel, Typo} from 'alinea/ui'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {Main} from 'alinea/ui/Main'
import {useTranslation} from '../hook/UseTranslation.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {Head} from '../util/Head.js'
import css from './RootOverview.module.scss'

const styles = styler(css)

export interface RootOverviewProps {
  root: RootData
}

export function RootOverview({root}: RootOverviewProps) {
  const {rootOverview: t} = useTranslation()
  const workspace = useWorkspace()
  return (
    <>
      <Head>
        <title>
          {workspace.label}: {root.label}
        </title>
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
          <Typo.P style={{textAlign: 'center', whiteSpace: 'pre-line'}}>
            {t.instruction}
          </Typo.P>
        </div>
      </Main>
    </>
  )
}
