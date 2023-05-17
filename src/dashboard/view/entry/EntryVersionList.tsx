import {Chip, HStack, fromModule} from 'alinea/ui'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {useLocation} from '../../util/HashRouter.js'
import css from './EntryVersionList.module.scss'

const styles = fromModule(css)

export interface EntryVersionListProps {
  editor: EntryEditor
}

export function EntryVersionList({editor}: EntryVersionListProps) {
  const location = useLocation()
  return (
    <ul className={styles.root()}>
      {editor.availablePhases.map(phase => {
        const {modifiedAt} = editor.phases[phase]
        const date = new Date(modifiedAt)
        return (
          <li key={phase}>
            <a
              className={styles.root.item({
                active: editor.phase === phase
              })}
              href={'#' + location.pathname + `?${phase}`}
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
