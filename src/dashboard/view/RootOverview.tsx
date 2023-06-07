import {renderLabel} from 'alinea/core'
import {RootData} from 'alinea/core/Root'
import {WorkspaceData} from 'alinea/core/Workspace'
import {Icon, TextLabel, Typo, fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {Head} from '../util/Head.js'
import css from './RootOverview.module.scss'

const styles = fromModule(css)

export interface RootOverviewProps {
  workspace: WorkspaceData
  root: RootData
}

export function RootOverview({workspace, root}: RootOverviewProps) {
  return (
    <>
      <Head>
        <title>{renderLabel(root.label)}</title>
      </Head>
      <Main>
        <div className={styles.root()}>
          <Icon
            icon={root.icon || IcRoundInsertDriveFile}
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
