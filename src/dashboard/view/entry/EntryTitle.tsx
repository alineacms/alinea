import styler from '@alinea/styler'
import {Type} from 'alinea/core/Type'
import {Chip, HStack, px} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import type {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
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
  const workspace = useWorkspace()
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const version = editor.statuses[selectedStatus]
  const type = editor.type
  const activeTitle = useAtomValue(editor.activeTitle)
  const title =
    selectedStatus === editor.activeStatus ? activeTitle : version.title
  return (
    <>
      <Head>
        <title>
          {workspace.label}: {title}
        </title>
      </Head>
      <div className={styles.root()}>
        <HStack center gap={12} wrap className={styles.root.inner()}>
          <HStack center gap={8}>
            {backLink && (
              <IconLink
                icon={IcRoundArrowBack}
                href={backLink}
                style={{marginLeft: px(-4)}}
              />
            )}
            <h1 className={styles.root.title()}>
              <span>{title}</span>
            </h1>
          </HStack>
          <Chip>{Type.label(type)}</Chip>
        </HStack>
        {children}
      </div>
    </>
  )
}
