import {EntryPhase, Type} from 'alinea/core'
import {renderLabel} from 'alinea/core/Label'
import {Chip, HStack, Stack, fromModule, px} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {useAtom, useAtomValue} from 'jotai'
import {PropsWithChildren} from 'react'
import {EntryEditor} from '../../atoms/EntryEditorAtoms.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import {Head} from '../../util/Head.js'
import {IconLink} from '../IconButton.js'
import {EditModeToggle} from './EditModeToggle.js'
import css from './EntryTitle.module.scss'

const styles = fromModule(css)

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
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const [editMode, setEditMode] = useAtom(editor.editMode)
  const version = editor.phases[selectedPhase]
  const type = editor.type
  const activeTitle = useAtomValue(editor.activeTitle)
  const title =
    selectedPhase === editor.activePhase ? activeTitle : version.title
  const hasChanges = useAtomValue(editor.hasChanges)
  return (
    <>
      <Head>
        <title>
          {title} - {renderLabel(label)}
        </title>
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
            <Chip>{renderLabel(Type.label(type))}</Chip>
          </HStack>
          {/*<IconButton icon={MdOutlineMoreHoriz} />*/}
          <Stack.Right>
            {(hasChanges ||
              (editor.availablePhases.includes(EntryPhase.Draft) &&
                editor.availablePhases.length > 1)) && (
              <EditModeToggle
                mode={editMode}
                onChange={mode => setEditMode(mode)}
              />
            )}
          </Stack.Right>
        </HStack>
        {children}
      </div>
    </>
  )
}
