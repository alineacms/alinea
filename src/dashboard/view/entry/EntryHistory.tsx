import {Revision} from 'alinea/backend/History'
import {Loader, fromModule} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {EntryEditProps} from '../EntryEdit.js'
import css from './EntryHistory.module.scss'

const styles = fromModule(css)

export function EntryHistory({editor}: EntryEditProps) {
  return (
    <header className={styles.root()}>
      <Suspense fallback={<Loader absolute />}>
        <RevisionList editor={editor} />
      </Suspense>
    </header>
  )
}

function RevisionList({editor}: EntryEditProps) {
  const revisions = useAtomValue(editor.revisionsAtom)
  return (
    <ul className={styles.list()}>
      {revisions.map(revision => {
        return (
          <RevisionItem
            key={revision.ref}
            editor={editor}
            revision={revision}
          />
        )
      })}
    </ul>
  )
}

interface RevisionItemProps {
  revision: Revision
  editor: EntryEditor
}

function RevisionItem({editor, revision}: RevisionItemProps) {
  const date = new Date(revision.createdAt)
  const rollbackRevision = useSetAtom(editor.rollbackRevision)
  return (
    <button
      key={revision.ref}
      title={revision.description}
      className={styles.list.revision()}
      onClick={() => rollbackRevision(revision.file, revision.ref)}
    >
      <Ellipsis>
        <b>{revision.user?.name}</b>
      </Ellipsis>
      {date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}
    </button>
  )
}
