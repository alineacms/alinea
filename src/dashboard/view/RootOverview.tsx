import {renderLabel} from 'alinea/core'
import {RootData} from 'alinea/core/Root'
import {Icon, TextLabel, Typo, fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {IcRoundDescription} from 'alinea/ui/icons/IcRoundDescription'
import {Head} from '../util/Head.js'
import css from './RootOverview.module.scss'

const styles = fromModule(css)

export interface RootOverviewProps {
  root: RootData
}

export function RootOverview({root}: RootOverviewProps) {
  return (
    <>
      <Head>
        <title>{renderLabel(root.label)}</title>
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
