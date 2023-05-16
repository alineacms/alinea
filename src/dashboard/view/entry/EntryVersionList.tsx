import {Chip, HStack, fromModule} from 'alinea/ui'
import {useAtom} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import css from './EntryVersionList.module.scss'

const styles = fromModule(css)

export interface EntryVersionListProps {
  editor: EntryEditor
}

export function EntryVersionList({editor}: EntryVersionListProps) {
  const [selectedPhase, setSelectedPhase] = useAtom(editor.selectedPhase)
  return (
    <ul className={styles.root()}>
      {editor.availablePhases.map(phase => {
        const {modifiedAt} = editor.phases[phase]
        const date = new Date(modifiedAt)
        return (
          <li key={phase}>
            <button
              className={styles.root.item({
                active: selectedPhase === phase
              })}
              onClick={() => setSelectedPhase(phase)}
            >
              <HStack center gap={25}>
                <small>
                  {date.toLocaleDateString()} {date.toLocaleTimeString()}
                </small>
                <Chip>{phase}</Chip>
              </HStack>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
