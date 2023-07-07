import {Button, HStack, Icon, Stack, fromModule} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {EditMode} from './EditMode.js'
import css from './EntryHeader.module.scss'

const styles = fromModule(css)

const variantDescription = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
}

const variantIcon = {
  draft: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  archived: IcRoundArchive
}

export interface EntryHeaderProps {
  editor: EntryEditor
}

export function EntryHeader({editor}: EntryHeaderProps) {
  const [mode, setMode] = useAtom(editor.editMode)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const isActivePhase = editor.activePhase === selectedPhase
  const hasChanges = useAtomValue(editor.hasChanges)
  const isSaving = useAtomValue(editor.isSaving)
  const variant =
    (hasChanges || isSaving) && isActivePhase ? 'draft' : selectedPhase
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  return (
    <AppBar.Root variant={variant}>
      <HStack center gap={10} className={styles.root.description()}>
        <Icon icon={variantIcon[variant]} size={18} />
        <span>{variantDescription[variant]}</span>
        {isActivePhase &&
          (hasChanges || isSaving ? (
            <button
              onClick={() =>
                setMode(
                  mode === EditMode.Editing ? EditMode.Diff : EditMode.Editing
                )
              }
            >
              {mode === EditMode.Editing ? '(show changes)' : '(close changes)'}
            </button>
          ) : (
            <span>(edit to create a new draft)</span>
          ))}
        <Stack.Right>
          <HStack center gap={8}>
            {hasChanges && variant === 'draft' && (
              <Button icon={IcRoundCheck} onClick={saveDraft}>
                Save draft
              </Button>
            )}
            {!hasChanges && selectedPhase === 'draft' && (
              <Button icon={IcOutlineRemoveRedEye} onClick={publishDraft}>
                Publish draft
              </Button>
            )}

            {/*<PopoverMenu.Root>
              <PopoverMenu.Trigger>
                <Icon icon={IcRoundMoreVert} />
              </PopoverMenu.Trigger>

              <PopoverMenu.Items right>open me</PopoverMenu.Items>
            </PopoverMenu.Root>*/}
          </HStack>
        </Stack.Right>
      </HStack>
    </AppBar.Root>
  )
}

{
  /*root.i18n && (
        <HStack center gap={8}>
          {root.i18n.locales.map(locale => {
            const translation = draft.translation(locale)
            const to = translation || draft
            return (
              <a
                key={locale}
                {...link(
                  nav.entry({
                    workspace: to.alinea.workspace,
                    root: to.alinea.root,
                    id: to.id,
                    locale
                  })
                )}
              >
                <Chip accent={currentLocale === locale}>
                  {translation ? (
                    <>{locale.toUpperCase()}: ✅</>
                  ) : (
                    <>{locale.toUpperCase()}: ❌</>
                  )}
                </Chip>
              </a>
            )
          })}
        </HStack>
      )*/
}
