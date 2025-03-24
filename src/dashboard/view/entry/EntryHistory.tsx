import styler from '@alinea/styler'
import type {Revision} from 'alinea/backend/Backend'
import {HStack, Icon, Loader, VStack} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundPublishedWithChanges} from 'alinea/ui/icons/IcRoundPublishedWithChanges'
import {useAtom, useAtomValue} from 'jotai'
import {Suspense} from 'react'
import type {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import type {EntryEditProps} from '../EntryEdit.js'
import css from './EntryHistory.module.scss'

const styles = styler(css)

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
      {revisions.map((revision, index) => {
        return (
          <RevisionItem
            key={revision.ref}
            editor={editor}
            revision={revision}
            isCurrent={index === 0}
          />
        )
      })}
    </ul>
  )
}

interface RevisionItemProps {
  revision: Revision
  editor: EntryEditor
  isCurrent: boolean
}

function RevisionItem({editor, revision, isCurrent}: RevisionItemProps) {
  const date = new Date(revision.createdAt)
  const [previewRevision, setPreviewRevision] = useAtom(editor.previewRevision)
  return (
    <button
      key={revision.ref}
      title={revision.description}
      className={styles.list.revision({
        selected: previewRevision
          ? previewRevision.ref === revision.ref
          : isCurrent,
        current: isCurrent
      })}
      onClick={() => setPreviewRevision(isCurrent ? undefined : revision)}
    >
      <HStack center gap={10}>
        {isCurrent ? (
          <Icon icon={IcOutlineRemoveRedEye} size={18} />
        ) : (
          <Icon icon={IcRoundPublishedWithChanges} size={18} />
        )}
        <VStack align="flex-start">
          <b>
            {date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </b>
          <Ellipsis>{revision.user?.name}</Ellipsis>
        </VStack>
      </HStack>
    </button>
  )
}
