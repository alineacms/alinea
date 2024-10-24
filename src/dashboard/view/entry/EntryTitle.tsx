import styler from '@alinea/styler'
import {Type} from 'alinea/core/Type'
import {Chip, HStack, Loader, px} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {useAtom, useAtomValue} from 'jotai'
import {PropsWithChildren} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import {Head} from '../../util/Head.js'
import {IconLink} from '../IconButton.js'
import css from './EntryTitle.module.scss'

const styles = styler(css)

export interface EntryTitleProps {
  editor: EntryEditor
  backLink?: string
}

export function EntryTitle({
  children,
  editor,
  backLink
}: PropsWithChildren<EntryTitleProps>) {
  const {label} = useWorkspace()
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const [editMode, setEditMode] = useAtom(editor.editMode)
  const version = editor.statuses[selectedStatus]
  const type = editor.type
  const activeTitle = useAtomValue(editor.activeTitle)
  const title =
    selectedStatus === editor.activeStatus ? activeTitle : version.title
  const hasChanges = useAtomValue(editor.hasChanges)
  const isLoading = useAtomValue(editor.isLoading)
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className={styles.root()}>
        <HStack center gap={8} className={styles.root.inner()}>
          {backLink && (
            <IconLink
              icon={IcRoundArrowBack}
              href={backLink}
              style={{marginLeft: px(-4)}}
            />
          )}
          <HStack center gap={12}>
            <h1 className={styles.root.title()}>
              <span>{title}</span>
            </h1>
            <Chip>{Type.label(type)}</Chip>
            {isLoading && <Loader size={15} />}
          </HStack>
        </HStack>
        {children}
      </div>
    </>
  )
}
