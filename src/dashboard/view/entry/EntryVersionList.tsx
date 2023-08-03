import {EntryPhase} from 'alinea/core'
import {Chip, HStack, fromModule} from 'alinea/ui'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import IcRoundArchive from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {useAtomValue} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useLocation} from '../../util/HashRouter.js'
import css from './EntryVersionList.module.scss'

const styles = fromModule(css)

const phaseVariant = {
  [EntryPhase.Archived]: 'disabled',
  [EntryPhase.Draft]: 'info',
  [EntryPhase.Published]: 'success'
} as const

const phaseIcon = {
  [EntryPhase.Draft]: IcRoundEdit,
  [EntryPhase.Published]: IcOutlineRemoveRedEye,
  [EntryPhase.Archived]: IcRoundArchive
}

export interface EntryVersionListProps {
  editor: EntryEditor
}

export function EntryVersionList({editor}: EntryVersionListProps) {
  const location = useLocation()
  const selectedPhase = useAtomValue(editor.selectedPhase)
  return (
    <ul className={styles.root()}>
      {editor.availablePhases.map((phase, i) => {
        const {modifiedAt} = editor.phases[phase]
        const date = new Date(modifiedAt)
        return (
          <li key={phase}>
            <a
              className={styles.root.item(
                {active: selectedPhase === phase},
                phase
              )}
              href={'#' + location.pathname + (i > 0 ? `?${phase}` : '')}
            >
              <HStack center gap={25}>
                <small>
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </small>
                <Chip variant={phaseVariant[phase]} icon={phaseIcon[phase]}>
                  {phase}
                </Chip>
              </HStack>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
