import {Chip, HStack, fromModule} from 'alinea/ui'
import {useAtomValue} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {useLocation} from '../../util/HashRouter.js'
import css from './EntryVersionList.module.scss'

const styles = fromModule(css)

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
                <Chip>{phase}</Chip>
              </HStack>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
